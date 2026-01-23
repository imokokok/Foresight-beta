export function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

export function readIntEnv(name: string, fallback: number): number {
  return Math.trunc(readNumberEnv(name, fallback));
}

export function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function maybeNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

export function pickFirstNonEmptyString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return undefined;
}
