export function pickFirstNonEmptyString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return undefined;
}

export function getConfiguredRpcUrl(chainId?: number): string {
  const id = chainId ?? getConfiguredChainId();

  const generic = pickFirstNonEmptyString(process.env.RPC_URL, process.env.NEXT_PUBLIC_RPC_URL);
  if (generic) return generic;

  if (id === 80002) {
    return (
      pickFirstNonEmptyString(
        process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
        "https://rpc-amoy.polygon.technology/"
      ) || "https://rpc-amoy.polygon.technology/"
    );
  }
  if (id === 137) {
    return (
      pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_POLYGON, "https://polygon-rpc.com") ||
      "https://polygon-rpc.com"
    );
  }
  if (id === 11155111) {
    return (
      pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_SEPOLIA, "https://rpc.sepolia.org") ||
      "https://rpc.sepolia.org"
    );
  }

  return "http://127.0.0.1:8545";
}

export function getConfiguredChainId(): number {
  const raw = String(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || "").trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 80002;
}
