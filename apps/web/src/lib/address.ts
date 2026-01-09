export function normalizeAddress(addr: string): string {
  const a = String(addr || "").trim();
  if (!a) return "";
  if (/^0x/i.test(a)) {
    return `0x${a.slice(2).toLowerCase()}`;
  }
  return a;
}

export function formatAddress(
  addr: string | null | undefined,
  prefixLen = 6,
  suffixLen = 4
): string {
  if (!addr) return "";
  const s = String(addr);
  if (s.length <= prefixLen + suffixLen + 3) return s;
  return `${s.slice(0, prefixLen)}...${s.slice(-suffixLen)}`;
}
