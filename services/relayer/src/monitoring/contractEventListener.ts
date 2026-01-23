import { logger } from "./logger.js";
import { initContractEventListener, closeContractEventListener } from "./contractEvents.js";
import { supabaseAdmin } from "../supabase.js";
import { CHAIN_ID } from "../env.js";
import { MatchingEngine } from "../matching/index.js";

// 解析 outcomeIndex
const parseOutcomeIndex = (value: unknown): number | null => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof (value as any).toString === "function") {
    const n = Number((value as any).toString());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// 同步市场决议到数据库
const syncMarketResolution = async (
  marketAddressRaw: string,
  status: "resolved" | "invalidated",
  outcomeIndex: number | null,
  matchingEngine: MatchingEngine
) => {
  if (!supabaseAdmin) return;
  const marketAddress = String(marketAddressRaw || "").toLowerCase();
  if (!marketAddress) return;
  const { data, error } = await supabaseAdmin
    .from("markets_map")
    .select("event_id,chain_id")
    .eq("market", marketAddress)
    .eq("chain_id", CHAIN_ID)
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error("Failed to load market map for resolution sync", {
      marketAddress,
      chainId: CHAIN_ID,
      error: error.message,
    });
    return;
  }
  if (!data) return;

  const nowIso = new Date().toISOString();
  const marketUpdate = await supabaseAdmin
    .from("markets_map")
    .update({ status })
    .eq("event_id", data.event_id)
    .eq("chain_id", data.chain_id);
  if (marketUpdate.error) {
    logger.error("Failed to update markets_map status", {
      marketAddress,
      eventId: data.event_id,
      chainId: data.chain_id,
      error: marketUpdate.error.message,
    });
  }

  const predictionUpdate: Record<string, any> = {
    status: status === "resolved" ? "completed" : "cancelled",
    settled_at: nowIso,
  };
  if (status === "resolved" && outcomeIndex !== null) {
    predictionUpdate.winning_outcome = String(outcomeIndex);
  }
  if (status === "invalidated") {
    predictionUpdate.winning_outcome = null;
  }
  const predictionRes = await supabaseAdmin
    .from("predictions")
    .update(predictionUpdate)
    .eq("id", data.event_id);
  if (predictionRes.error) {
    logger.error("Failed to update prediction status", {
      eventId: data.event_id,
      status: predictionUpdate.status,
      error: predictionRes.error.message,
    });
  }

  const marketKey = `${data.chain_id}:${data.event_id}`;
  try {
    await matchingEngine.closeMarket(marketKey, { reason: status });
  } catch (error: any) {
    logger.error("Failed to close market orderbook", {
      marketKey,
      reason: status,
      error: String(error?.message || error),
    });
  }
};

// 初始化合约事件监听器
export async function initializeContractListener(matchingEngine: MatchingEngine) {
  try {
    const marketFactoryAddress = process.env.MARKET_FACTORY_ADDRESS;
    if (!marketFactoryAddress) {
      logger.warn("MARKET_FACTORY_ADDRESS 未配置，跳过合约事件监听器初始化");
      return;
    }

    // 导入合约ABI
    const MarketFactoryABI: any[] = [];
    const OffchainMarketBaseABI: any[] = [];
    const OutcomeToken1155ABI: any[] = [];

    await initContractEventListener({
      marketFactoryAddress,
      marketFactoryAbi: MarketFactoryABI,
      offchainMarketAbi: OffchainMarketBaseABI,
      outcomeTokenAbi: OutcomeToken1155ABI,
      eventHandlers: {
        Resolved: async (event: any) => {
          logger.info("Market resolved", {
            marketAddress: event.address,
            outcomeIndex:
              parseOutcomeIndex(event?.args?.outcomeIndex) === null
                ? null
                : String(parseOutcomeIndex(event?.args?.outcomeIndex)),
          });
          await syncMarketResolution(
            event.address,
            "resolved",
            parseOutcomeIndex(event?.args?.outcomeIndex),
            matchingEngine
          );
        },
        Invalidated: async (event: any) => {
          logger.warn("Market invalidated", {
            marketAddress: event.address,
          });
          await syncMarketResolution(event.address, "invalidated", null, matchingEngine);
        },
      },
    });

    logger.info("合约事件监听器初始化成功");
  } catch (error) {
    logger.error("合约事件监听器初始化失败", {
      error: String(error),
    });
  }
}

export { closeContractEventListener };
