export function normalizeAddress(addr: string): string {
  const a = String(addr || "").trim();
  if (!a) return "";
  if (/^0x/i.test(a)) {
    const normalized = `0x${a.slice(2).toLowerCase()}`;
    if (/^0x[a-f0-9]{40}$/.test(normalized)) {
      return normalized;
    }
    return "";
  }
  if (/^[a-f0-9]{40}$/i.test(a)) {
    return `0x${a.toLowerCase()}`;
  }
  return "";
}

export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
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
