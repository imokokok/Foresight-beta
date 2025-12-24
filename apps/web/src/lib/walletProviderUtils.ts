"use client";

export function getFallbackRpcUrl(chainIdNum?: number): string | null {
  const env = process.env || ({} as any);
  const id = Number(chainIdNum || 1);
  switch (id) {
    case 1:
      return (
        env.NEXT_PUBLIC_RPC_MAINNET ||
        env.NEXT_PUBLIC_RPC_ETHEREUM ||
        env.NEXT_PUBLIC_RPC_URL ||
        "https://ethereum.publicnode.com"
      );
    case 11155111:
      return env.NEXT_PUBLIC_RPC_SEPOLIA || env.NEXT_PUBLIC_RPC_URL || "https://rpc.sepolia.org";
    case 137:
      return env.NEXT_PUBLIC_RPC_POLYGON || env.NEXT_PUBLIC_RPC_URL || "https://polygon-rpc.com";
    case 80002:
      return (
        env.NEXT_PUBLIC_RPC_POLYGON_AMOY ||
        env.NEXT_PUBLIC_RPC_URL ||
        "https://rpc-amoy.polygon.technology"
      );
    case 56:
      return (
        env.NEXT_PUBLIC_RPC_BSC || env.NEXT_PUBLIC_RPC_URL || "https://bsc-dataseed.binance.org"
      );
    default:
      return env.NEXT_PUBLIC_RPC_URL || null;
  }
}
