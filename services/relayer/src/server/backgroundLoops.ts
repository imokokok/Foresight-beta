import { ethers } from "ethers";
import { readIntEnv } from "../utils/envNumbers.js";
import { getClusterManager } from "../cluster/index.js";
import { supabaseAdmin } from "../supabase.js";
import type { MatchingEngine } from "../matching/index.js";
import { ingestTradesByLogs } from "../orderbook.js";

type LoggerLike = {
  info: (message: string, context?: any) => void;
  warn: (message: string, context?: any, error?: any) => void;
};

type BackgroundLoopOptions = {
  logger: LoggerLike;
  matchingEngine: MatchingEngine;
  provider: ethers.JsonRpcProvider | null;
  isClusterActive: () => boolean;
};

export function createBackgroundLoops(opts: BackgroundLoopOptions) {
  let autoIngestTimer: NodeJS.Timeout | null = null;
  let marketExpiryTimer: NodeJS.Timeout | null = null;

  async function startMarketExpiryLoop() {
    if (String(process.env.RELAYER_MARKET_EXPIRY_ENABLED || "").toLowerCase() === "false") return;
    if (!supabaseAdmin) {
      opts.logger.warn("Market expiry loop disabled: Supabase not configured");
      return;
    }
    const supabase = supabaseAdmin;

    const pollMs = Math.max(5000, readIntEnv("RELAYER_MARKET_EXPIRY_POLL_MS", 30000));
    let running = false;

    if (marketExpiryTimer) {
      clearInterval(marketExpiryTimer);
      marketExpiryTimer = null;
    }

    const loop = async () => {
      if (running) return;
      running = true;
      try {
        if (opts.isClusterActive()) {
          const cluster = getClusterManager();
          if (!cluster.isLeader()) return;
        }

        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("markets_map")
          .select("event_id,chain_id,resolution_time,status")
          .eq("status", "open")
          .not("resolution_time", "is", null)
          .lte("resolution_time", nowIso)
          .limit(200);

        if (error) {
          opts.logger.warn("Market expiry loop query failed", {
            error: error.message,
          });
          return;
        }
        if (!data || data.length === 0) return;

        for (const row of data as any[]) {
          const eventId = Number(row.event_id);
          const chainId = Number(row.chain_id);
          if (!Number.isFinite(eventId) || !Number.isFinite(chainId)) continue;
          const marketKey = `${chainId}:${eventId}`;

          const updateRes = await supabase
            .from("markets_map")
            .update({ status: "closed" })
            .eq("event_id", eventId)
            .eq("chain_id", chainId)
            .eq("status", "open");
          if (updateRes.error) {
            opts.logger.warn("Failed to update market status to closed", {
              marketKey,
              error: updateRes.error.message,
            });
            continue;
          }

          const predictionUpdate = await supabase
            .from("predictions")
            .update({
              status: "completed",
              settled_at: new Date().toISOString(),
            })
            .eq("id", eventId)
            .eq("status", "active");
          if (predictionUpdate.error) {
            opts.logger.warn("Failed to update prediction status for expired market", {
              marketKey,
              error: predictionUpdate.error.message,
            });
          }

          try {
            await opts.matchingEngine.closeMarket(marketKey, { reason: "expired" });
          } catch (error: any) {
            opts.logger.warn("Failed to close expired market orderbook", {
              marketKey,
              error: String(error?.message || error),
            });
          }
        }
      } catch (e) {
        const error = e as Error;
        opts.logger.warn("Market expiry loop failed", { error: String(error?.message || error) });
      } finally {
        running = false;
      }
    };

    await loop();
    marketExpiryTimer = setInterval(loop, pollMs);
    opts.logger.info("Market expiry loop enabled", { pollMs });
  }

  async function startAutoIngestLoop() {
    if (process.env.RELAYER_AUTO_INGEST !== "1") return;
    if (!supabaseAdmin) {
      console.warn("[auto-ingest] Supabase not configured, disabled");
      return;
    }
    if (!opts.provider) {
      console.warn("[auto-ingest] Provider not configured (RPC_URL), disabled");
      return;
    }

    let chainId: number;
    try {
      const net = await opts.provider.getNetwork();
      chainId = Number(net.chainId);
    } catch (e) {
      const error = e as Error;
      console.warn("[auto-ingest] failed to get network:", String(error?.message || error));
      return;
    }

    const cursorKey = "order_filled_signed";
    const configuredFrom = Math.max(0, readIntEnv("RELAYER_AUTO_INGEST_FROM_BLOCK", 0));
    const lookback = Math.max(0, readIntEnv("RELAYER_AUTO_INGEST_REORG_LOOKBACK", 20));
    let last = 0;
    const confirmations = Math.max(0, readIntEnv("RELAYER_AUTO_INGEST_CONFIRMATIONS", 1));
    const pollMs = Math.max(2000, readIntEnv("RELAYER_AUTO_INGEST_POLL_MS", 5000));
    const maxConcurrent = Math.max(1, readIntEnv("RELAYER_AUTO_INGEST_CONCURRENCY", 3));
    let ingestRunning = false;

    if (autoIngestTimer) {
      clearInterval(autoIngestTimer);
      autoIngestTimer = null;
    }

    const loadCursor = async (): Promise<number> => {
      try {
        const { data, error } = await supabaseAdmin!
          .from("relayer_ingest_cursors")
          .select("last_processed_block")
          .eq("chain_id", chainId)
          .eq("cursor_key", cursorKey)
          .maybeSingle();
        if (error) {
          const code = (error as any).code;
          if (code === "42P01" || code === "42703") return 0;
          console.warn("[auto-ingest] cursor load error:", String(error.message || error));
          return 0;
        }
        const raw = (data as any)?.last_processed_block;
        const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : 0;
        return Number.isFinite(n) ? n : 0;
      } catch (e) {
        const error = e as Error;
        console.warn("[auto-ingest] cursor load exception:", String(error?.message || error));
        return 0;
      }
    };

    const saveCursor = async (blockNumber: number): Promise<void> => {
      try {
        const { error } = await supabaseAdmin!.from("relayer_ingest_cursors").upsert(
          {
            chain_id: chainId,
            cursor_key: cursorKey,
            last_processed_block: blockNumber,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "chain_id,cursor_key" }
        );
        if (error) {
          const code = (error as any).code;
          if (code === "42P01" || code === "42703") return;
          console.warn("[auto-ingest] cursor save error:", String(error.message || error));
        }
      } catch (e) {
        const error = e as Error;
        console.warn("[auto-ingest] cursor save exception:", String(error?.message || error));
      }
    };

    const persistedLast = await loadCursor();
    if (configuredFrom > 0) {
      last = configuredFrom;
    } else {
      last = persistedLast > 0 ? Math.max(0, persistedLast - lookback) : 0;
    }

    const loop = async () => {
      if (ingestRunning) return;
      ingestRunning = true;
      try {
        if (opts.isClusterActive()) {
          const cluster = getClusterManager();
          if (!cluster.isLeader()) return;
        }

        const head = await opts.provider!.getBlockNumber();
        const target = Math.max(0, head - confirmations);
        if (last === 0) last = target;
        if (target <= last) return;

        const maxStep = Math.max(1, readIntEnv("RELAYER_AUTO_INGEST_MAX_STEP", 20));
        const to = Math.min(target, last + maxStep);

        const fromBlock = last + 1;
        if (fromBlock > to) return;

        const startTime = Date.now();
        let totalIngested = 0;
        let processedTo = last;
        try {
          const r = await ingestTradesByLogs(chainId, fromBlock, to, maxConcurrent);
          totalIngested += r.ingestedCount || 0;
          processedTo = to;
          last = processedTo;
          await saveCursor(processedTo);
        } catch (e) {
          const error = e as Error;
          console.warn(
            "[auto-ingest] ingestTradesByLogs range error:",
            String(error?.message || error),
            chainId,
            fromBlock,
            to
          );
          for (let b = fromBlock; b <= to; b++) {
            try {
              const r = await ingestTradesByLogs(chainId, b, b, maxConcurrent);
              totalIngested += r.ingestedCount || 0;
              processedTo = b;
              last = processedTo;
              await saveCursor(processedTo);
            } catch (e) {
              const errorInner = e as Error;
              console.warn(
                "[auto-ingest] ingestTradesByLogs error:",
                String(errorInner?.message || errorInner),
                chainId,
                b
              );
              break;
            }
          }
        }
        const duration = Date.now() - startTime;
        console.log(
          "[auto-ingest] window",
          fromBlock,
          "to",
          to,
          "events",
          totalIngested,
          "durationMs",
          duration
        );
      } catch (e) {
        const error = e as Error;
        console.warn("[auto-ingest] loop error:", String(error?.message || error));
      } finally {
        ingestRunning = false;
      }
    };

    await loop();
    autoIngestTimer = setInterval(loop, pollMs);
    console.log("[auto-ingest] enabled");
  }

  function stopAutoIngestLoop() {
    if (autoIngestTimer) {
      clearInterval(autoIngestTimer);
      autoIngestTimer = null;
    }
  }

  return {
    startMarketExpiryLoop,
    startAutoIngestLoop,
    stopAutoIngestLoop,
  };
}
