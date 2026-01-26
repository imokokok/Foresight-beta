import type { Request } from "express";
import { getRedisClient } from "../redis/client.js";

type IdempotencyEntry = {
  expiresAtMs: number;
  status: number;
  body: any;
};

export function createIdempotency(readIntEnv: (name: string, fallback: number) => number) {
  const idempotencyStore = new Map<string, IdempotencyEntry>();
  let idempotencyCleanupIter: IterableIterator<[string, IdempotencyEntry]> | null = null;
  let idempotencyLastCleanupAtMs = 0;

  function cleanupIdempotencyStore(nowMs: number, maxScan: number) {
    try {
      if (!idempotencyCleanupIter) {
        idempotencyCleanupIter = idempotencyStore.entries();
      }
      let scanned = 0;
      while (scanned < maxScan) {
        try {
          const n = idempotencyCleanupIter.next();
          if (n.done) {
            idempotencyCleanupIter = null;
            break;
          }
          scanned += 1;
          const [k, v] = n.value;
          if (v.expiresAtMs <= nowMs) idempotencyStore.delete(k);
        } catch {
          idempotencyCleanupIter = null;
          break;
        }
      }
    } catch {
      idempotencyCleanupIter = null;
    }
  }

  function getIdempotencyKey(req: Request, extra: string): string | null {
    const headerKey = String(req.headers["x-idempotency-key"] || "").trim();
    const requestId = String(req.headers["x-request-id"] || (req as any).requestId || "").trim();
    const base = headerKey || requestId;
    if (!base) return null;
    return `${req.method}:${extra}:${base}`;
  }

  function getIdempotencyRedisKey(key: string): string {
    return `idempotency:${key}`;
  }

  async function getIdempotencyEntry(key: string): Promise<IdempotencyEntry | null> {
    const entry = idempotencyStore.get(key);
    if (entry) {
      if (entry.expiresAtMs <= Date.now()) {
        idempotencyStore.delete(key);
      } else {
        return entry;
      }
    }

    if (process.env.RELAYER_IDEMPOTENCY_REDIS === "false") return null;

    const redis = getRedisClient();
    if (!redis.isReady()) return null;

    const raw = await redis.get(getIdempotencyRedisKey(key));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as IdempotencyEntry;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.expiresAtMs !== "number" ||
        typeof parsed.status !== "number"
      ) {
        return null;
      }
      if (parsed.expiresAtMs <= Date.now()) return null;
      idempotencyStore.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  async function setIdempotencyEntry(key: string, status: number, body: any): Promise<void> {
    const ttlMs = Math.max(1000, readIntEnv("RELAYER_IDEMPOTENCY_TTL_MS", 60000));
    const entry: IdempotencyEntry = {
      expiresAtMs: Date.now() + ttlMs,
      status,
      body,
    };
    idempotencyStore.set(key, entry);
    const now = Date.now();
    if (
      (idempotencyStore.size > 2000 && now - idempotencyLastCleanupAtMs > 1000) ||
      idempotencyStore.size > 8000
    ) {
      idempotencyLastCleanupAtMs = now;
      cleanupIdempotencyStore(now, idempotencyStore.size > 8000 ? 2000 : 200);
    }
    const hardCap = Math.max(1000, readIntEnv("RELAYER_IDEMPOTENCY_MAX_KEYS", 10000));
    if (idempotencyStore.size > hardCap) {
      cleanupIdempotencyStore(now, 5000);
      while (idempotencyStore.size > hardCap) {
        const oldestKey = idempotencyStore.keys().next().value;
        if (!oldestKey) break;
        idempotencyStore.delete(oldestKey);
      }
    }

    if (process.env.RELAYER_IDEMPOTENCY_REDIS === "false") return;
    const redis = getRedisClient();
    if (!redis.isReady()) return;

    const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
    try {
      await redis.set(getIdempotencyRedisKey(key), JSON.stringify(entry), ttlSeconds);
    } catch {}
  }

  function setIdempotencyIfPresent(idemKey: string | null, status: number, body: any): void {
    if (!idemKey) return;
    if (status >= 500) return;
    void setIdempotencyEntry(idemKey, status, body);
  }

  return {
    getIdempotencyKey,
    getIdempotencyEntry,
    setIdempotencyEntry,
    setIdempotencyIfPresent,
  };
}
