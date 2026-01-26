export type MicroCacheEntry<T> = { expiresAtMs: number; value: T };

export function microCacheGet<T>(cache: Map<string, MicroCacheEntry<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAtMs <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function microCacheSet<T>(
  cache: Map<string, MicroCacheEntry<T>>,
  key: string,
  ttlMs: number,
  value: T,
  maxSize: number
) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
  cache.set(key, { expiresAtMs: Date.now() + ttlMs, value });
  if (cache.size > maxSize) {
    const cleanupThreshold = maxSize * 0.2;
    const targetSize = maxSize * 0.8;
    let cleaned = 0;
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [k, v] of cache.entries()) {
      if (v.expiresAtMs <= now || (cache.size > targetSize && cleaned < cleanupThreshold)) {
        entriesToDelete.push(k);
        cleaned++;
      }
      if (cache.size - entriesToDelete.length <= targetSize) break;
    }

    for (const k of entriesToDelete) {
      cache.delete(k);
    }
  }
}
