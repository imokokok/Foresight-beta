import { normalizeAddress } from "@/lib/serverUtils";

export function parsePredictionId(raw: unknown) {
  const predictionId = Number(raw);
  return predictionId;
}

export function parseWalletAddressStrict(raw: unknown) {
  const wa = normalizeAddress(String(raw || ""));
  const walletAddress = /^0x[a-f0-9]{40}$/.test(wa) ? wa : "";
  return { wa, walletAddress };
}
