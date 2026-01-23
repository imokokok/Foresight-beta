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
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}
