import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });

// 环境变量校验与读取
const EthPrivateKeySchema = z.preprocess(
  (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (/^[0-9a-fA-F]{64}$/.test(s)) return "0x" + s;
    return s;
  },
  z.string().regex(/^0x[0-9a-fA-F]{64}$/)
);

const EthAddressSchema = z.preprocess(
  (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (/^[0-9a-fA-F]{40}$/.test(s)) return "0x" + s;
    return s;
  },
  z.string().regex(/^0x[0-9a-fA-F]{40}$/)
);

const BoolSchema = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return v;
  const s = v.trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
  if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  return v;
}, z.boolean());

function maybeNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

function pickFirstNonEmptyString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return undefined;
}

function maybeUrl(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

function maybeIntString(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  if (!/^\d+$/.test(s)) return undefined;
  return s;
}

function maybeBoolString(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  const lower = s.toLowerCase();
  if (
    lower === "1" ||
    lower === "0" ||
    lower === "true" ||
    lower === "false" ||
    lower === "yes" ||
    lower === "no" ||
    lower === "on" ||
    lower === "off"
  ) {
    return lower;
  }
  return undefined;
}

function maybeEthPrivateKey(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return "0x" + s;
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s;
  return undefined;
}

function maybeEthAddress(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  if (/^[0-9a-fA-F]{40}$/.test(s)) return "0x" + s;
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s;
  return undefined;
}

const EnvSchema = z.object({
  BUNDLER_PRIVATE_KEY: EthPrivateKeySchema.optional(),
  OPERATOR_PRIVATE_KEY: EthPrivateKeySchema.optional(),
  RELAYER_GASLESS_SIGNER_PRIVATE_KEY: EthPrivateKeySchema.optional(),
  CUSTODIAL_SIGNER_PRIVATE_KEY: EthPrivateKeySchema.optional(),
  AA_ENABLED: BoolSchema.optional(),
  GASLESS_ENABLED: BoolSchema.optional(),
  EMBEDDED_AUTH_ENABLED: BoolSchema.optional(),
  RELAYER_GASLESS_PAYMASTER_URL: z.string().url().optional(),
  ENTRYPOINT_ADDRESS: EthAddressSchema.optional(),
  RPC_URL: z.string().url().optional(),
  CHAIN_ID: z
    .preprocess(
      (v) => (typeof v === "string" && v.length > 0 ? Number(v) : v),
      z.number().int().positive()
    )
    .optional(),
  RELAYER_LEADER_PROXY_URL: z.string().url().optional(),
  RELAYER_LEADER_URL: z.string().url().optional(),
  RELAYER_PORT: z
    .preprocess(
      (v) => (typeof v === "string" && v.length > 0 ? Number(v) : v),
      z.number().int().positive()
    )
    .optional(),
  PORT: z
    .preprocess(
      (v) => (typeof v === "string" && v.length > 0 ? Number(v) : v),
      z.number().int().positive()
    )
    .optional(),
  NEXT_PUBLIC_PROXY_WALLET_TYPE: z.enum(["safe", "safe4337", "proxy"]).optional(),
  PROXY_WALLET_FACTORY_ADDRESS: EthAddressSchema.optional(),
  SAFE_FACTORY_ADDRESS: EthAddressSchema.optional(),
  SAFE_SINGLETON_ADDRESS: EthAddressSchema.optional(),
  SAFE_FALLBACK_HANDLER_ADDRESS: EthAddressSchema.optional(),
});

const DEFAULT_RPC_URLS: Record<number, string> = {
  80002: "https://rpc-amoy.polygon.technology/",
  137: "https://polygon-rpc.com",
  11155111: "https://rpc.sepolia.org",
};

const preChainId = (() => {
  const s = maybeIntString(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID);
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing CHAIN_ID");
    }
    return 80002;
  }
  const n = s ? Number(s) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 80002;
})();

const rawEnv = {
  BUNDLER_PRIVATE_KEY: maybeEthPrivateKey(
    process.env.BUNDLER_PRIVATE_KEY || process.env.PRIVATE_KEY
  ),
  OPERATOR_PRIVATE_KEY: maybeEthPrivateKey(process.env.OPERATOR_PRIVATE_KEY),
  RELAYER_GASLESS_SIGNER_PRIVATE_KEY: maybeEthPrivateKey(
    process.env.RELAYER_GASLESS_SIGNER_PRIVATE_KEY
  ),
  AA_ENABLED: maybeBoolString(
    process.env.AA_ENABLED || process.env.NEXT_PUBLIC_AA_ENABLED || process.env.aa_enabled
  ),
  GASLESS_ENABLED: maybeBoolString(
    process.env.GASLESS_ENABLED || process.env.AA_ENABLED || process.env.NEXT_PUBLIC_AA_ENABLED
  ),
  EMBEDDED_AUTH_ENABLED: maybeBoolString(
    process.env.EMBEDDED_AUTH_ENABLED ||
      process.env.NEXT_PUBLIC_EMBEDDED_AUTH_ENABLED ||
      process.env.embedded_auth_enabled
  ),
  CUSTODIAL_SIGNER_PRIVATE_KEY: maybeEthPrivateKey(process.env.CUSTODIAL_SIGNER_PRIVATE_KEY),
  RELAYER_GASLESS_PAYMASTER_URL: maybeUrl(process.env.RELAYER_GASLESS_PAYMASTER_URL),
  ENTRYPOINT_ADDRESS: maybeEthAddress(
    process.env.ENTRYPOINT_ADDRESS || process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS
  ),
  RPC_URL: maybeUrl(
    pickFirstNonEmptyString(
      process.env.RPC_URL,
      process.env.NEXT_PUBLIC_RPC_URL,
      preChainId === 80002 ? process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY : undefined,
      preChainId === 137 ? process.env.NEXT_PUBLIC_RPC_POLYGON : undefined,
      preChainId === 11155111 ? process.env.NEXT_PUBLIC_RPC_SEPOLIA : undefined
    )
  ),
  CHAIN_ID: maybeIntString(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID),
  RELAYER_LEADER_PROXY_URL: maybeUrl(process.env.RELAYER_LEADER_PROXY_URL),
  RELAYER_LEADER_URL: maybeUrl(process.env.RELAYER_LEADER_URL),
  RELAYER_PORT: maybeIntString(process.env.RELAYER_PORT),
  PORT: maybeIntString(process.env.PORT),
  NEXT_PUBLIC_PROXY_WALLET_TYPE: (() => {
    const t = String(process.env.NEXT_PUBLIC_PROXY_WALLET_TYPE || "")
      .trim()
      .toLowerCase();
    return t === "safe" || t === "safe4337" || t === "proxy" ? (t as any) : undefined;
  })(),
  PROXY_WALLET_FACTORY_ADDRESS: maybeEthAddress(process.env.PROXY_WALLET_FACTORY_ADDRESS),
  SAFE_FACTORY_ADDRESS: maybeEthAddress(process.env.SAFE_FACTORY_ADDRESS),
  SAFE_SINGLETON_ADDRESS: maybeEthAddress(process.env.SAFE_SINGLETON_ADDRESS),
  SAFE_FALLBACK_HANDLER_ADDRESS: maybeEthAddress(process.env.SAFE_FALLBACK_HANDLER_ADDRESS),
};

const parsed = EnvSchema.safeParse(rawEnv);
if (!parsed.success) {
  console.warn("Relayer env invalid:", parsed.error.flatten().fieldErrors);
}

export const BUNDLER_PRIVATE_KEY = parsed.success ? parsed.data.BUNDLER_PRIVATE_KEY : undefined;
export const OPERATOR_PRIVATE_KEY = parsed.success ? parsed.data.OPERATOR_PRIVATE_KEY : undefined;
export const RELAYER_GASLESS_SIGNER_PRIVATE_KEY = parsed.success
  ? parsed.data.RELAYER_GASLESS_SIGNER_PRIVATE_KEY
  : undefined;
export const AA_ENABLED = parsed.success ? (parsed.data.AA_ENABLED ?? false) : false;
export const EMBEDDED_AUTH_ENABLED = parsed.success
  ? (parsed.data.EMBEDDED_AUTH_ENABLED ?? false)
  : false;
export const CUSTODIAL_SIGNER_PRIVATE_KEY = parsed.success
  ? parsed.data.CUSTODIAL_SIGNER_PRIVATE_KEY
  : undefined;
export const GASLESS_ENABLED = (() => {
  if (!parsed.success) return false;
  const aa = Boolean(parsed.data.AA_ENABLED ?? false);
  const gasless = Boolean(parsed.data.GASLESS_ENABLED ?? parsed.data.AA_ENABLED ?? false);
  return aa && gasless;
})();
export const RELAYER_GASLESS_PAYMASTER_URL = parsed.success
  ? parsed.data.RELAYER_GASLESS_PAYMASTER_URL
  : undefined;
export const ENTRYPOINT_ADDRESS = parsed.success ? parsed.data.ENTRYPOINT_ADDRESS : undefined;
export const CHAIN_ID = parsed.success ? (parsed.data.CHAIN_ID ?? 80002) : 80002;
export const RELAYER_LEADER_PROXY_URL = parsed.success
  ? parsed.data.RELAYER_LEADER_PROXY_URL
  : undefined;
export const RELAYER_LEADER_URL = parsed.success ? parsed.data.RELAYER_LEADER_URL : undefined;
export const PROXY_WALLET_TYPE = parsed.success
  ? parsed.data.NEXT_PUBLIC_PROXY_WALLET_TYPE
  : undefined;
export const PROXY_WALLET_FACTORY_ADDRESS = parsed.success
  ? parsed.data.PROXY_WALLET_FACTORY_ADDRESS
  : undefined;
export const SAFE_FACTORY_ADDRESS = parsed.success ? parsed.data.SAFE_FACTORY_ADDRESS : undefined;
export const SAFE_SINGLETON_ADDRESS = parsed.success
  ? parsed.data.SAFE_SINGLETON_ADDRESS
  : undefined;
export const SAFE_FALLBACK_HANDLER_ADDRESS = parsed.success
  ? parsed.data.SAFE_FALLBACK_HANDLER_ADDRESS
  : undefined;
const DEFAULT_RPC_URL = DEFAULT_RPC_URLS[CHAIN_ID] || "http://127.0.0.1:8545";
export const RPC_URL = (parsed.success ? parsed.data.RPC_URL : undefined) || DEFAULT_RPC_URL;
export const RELAYER_PORT =
  (parsed.success ? (parsed.data.RELAYER_PORT ?? parsed.data.PORT) : undefined) ?? 3000;
