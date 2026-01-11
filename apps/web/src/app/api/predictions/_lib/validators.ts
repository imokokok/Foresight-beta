import type { NextRequest } from "next/server";
import { getSessionAddress, isAdminAddress, normalizeAddress } from "@/lib/serverUtils";

export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export async function resolveAndVerifyWalletAddress(
  request: NextRequest,
  body: any
): Promise<{ walletAddress: string; sessionAddress?: string | null }> {
  const sessAddr = await getSessionAddress(request);
  let walletAddress: string = normalizeAddress(String(body.walletAddress || ""));
  if (!walletAddress && sessAddr) walletAddress = normalizeAddress(sessAddr);

  if (!isValidEthAddress(walletAddress)) {
    const err = new Error("Invalid wallet address format");
    (err as any).status = 400;
    throw err;
  }

  if (sessAddr && normalizeAddress(sessAddr) !== walletAddress) {
    const err = new Error("Unauthorized or session address does not match");
    (err as any).status = 401;
    throw err;
  }

  return { walletAddress, sessionAddress: sessAddr };
}

export function assertRequiredFields(body: Record<string, unknown>, requiredFields: string[]) {
  const missingFields = requiredFields.filter((field) => {
    const value = body[field];
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return value.trim().length === 0;
    return false;
  });
  if (missingFields.length > 0) {
    const err = new Error("Missing required fields");
    (err as any).status = 400;
    (err as any).missingFields = missingFields;
    throw err;
  }
}

export function assertPositiveNumber(value: any, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    const err = new Error(`${fieldName} must be a positive number`);
    (err as any).status = 400;
    throw err;
  }
}

export function resolveImageUrl(
  body: any,
  buildDiceBearUrl: (seed: string, qs: string) => string
): string {
  const seed =
    String(body.title || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase() || "prediction";

  if (body.imageUrl) {
    if (typeof body.imageUrl !== "string") {
      const err = new Error("Invalid imageUrl format");
      (err as any).status = 400;
      throw err;
    }
    if (body.imageUrl.includes("supabase.co")) return body.imageUrl;
    if (body.imageUrl.startsWith("https://")) return body.imageUrl;
  }

  return buildDiceBearUrl(seed, "&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20");
}

export function assertValidOutcomes(body: any): { type: "binary" | "multi"; outcomes: any[] } {
  const type = String(body.type || "binary");
  const outcomes = Array.isArray(body.outcomes) ? body.outcomes : [];
  if (type === "multi") {
    if (outcomes.length < 3 || outcomes.length > 8) {
      const err = new Error("Multi-outcome events must have between 3 and 8 options");
      (err as any).status = 400;
      throw err;
    }
    if (outcomes.some((o: any) => !String(o?.label || "").trim())) {
      const err = new Error("Each option must have a non-empty label");
      (err as any).status = 400;
      throw err;
    }
    return { type: "multi", outcomes };
  }
  return { type: "binary", outcomes: [] };
}

export function isAdminProfile(profile: any, walletAddress: string): boolean {
  return !!profile?.is_admin || isAdminAddress(walletAddress);
}
