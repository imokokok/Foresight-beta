import { formatUnits } from "ethers";

export const BIGINT_ZERO = BigInt(0);
export const BIGINT_THRESHOLD = BigInt("1000000000000");

export function decodePrice(p: string) {
  try {
    const v = BigInt(p);
    if (v === BIGINT_ZERO) return 0;
    const decimals = v > BIGINT_THRESHOLD ? 18 : 6;
    const val = Number(formatUnits(v, decimals));
    return Number.isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

export function formatPrice(p: string, showCents = false) {
  try {
    const val = decodePrice(p);
    if (val === 0) return "-";
    if (showCents) {
      if (val < 1) return (val * 100).toFixed(1) + "¢";
    }
    return val.toFixed(2);
  } catch {
    return "-";
  }
}

export function formatAmount(raw: string) {
  try {
    const v = BigInt(raw);
    if (v === BIGINT_ZERO) return "0";
    if (v > BIGINT_THRESHOLD) {
      return Number(formatUnits(v, 18)).toFixed(4);
    }
    return raw;
  } catch {
    return raw;
  }
}
