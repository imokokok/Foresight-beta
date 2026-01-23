import { z } from "zod";

export const HexAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((v) => v.toLowerCase());

export const HexDataSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]+$/);

export const HexDataOrEmptySchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]*$/);

export const BigIntFromNumberishSchema = z.preprocess((v) => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return v;
    return BigInt(Math.trunc(v));
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return v;
    try {
      return BigInt(s);
    } catch {
      return v;
    }
  }
  return v;
}, z.bigint());

export const GaslessOrderSchema = z.object({
  marketKey: z.string().min(1),
  chainId: z.number().int().positive(),
  marketAddress: HexAddressSchema,
  usdcAddress: HexAddressSchema.optional(),
  userAddress: HexAddressSchema,
  fillAmount: BigIntFromNumberishSchema,
  order: z.object({
    maker: HexAddressSchema,
    outcomeIndex: z.number().int().min(0),
    isBuy: z.boolean(),
    price: BigIntFromNumberishSchema,
    amount: BigIntFromNumberishSchema,
    salt: BigIntFromNumberishSchema,
    expiry: BigIntFromNumberishSchema,
  }),
  orderSignature: HexDataSchema,
  permit: z
    .object({
      owner: HexAddressSchema,
      spender: HexAddressSchema,
      value: BigIntFromNumberishSchema,
      nonce: BigIntFromNumberishSchema,
      deadline: BigIntFromNumberishSchema,
      signature: HexDataSchema,
    })
    .optional(),
  meta: z
    .object({
      clientOrderId: z.string().max(128).optional(),
      deviceId: z.string().max(128).optional(),
      intentType: z.enum(["order"]).optional(),
      maxCostUsd: z.number().positive().optional(),
    })
    .optional(),
});

export const UserOperationSchema = z.object({
  sender: HexAddressSchema,
  nonce: BigIntFromNumberishSchema,
  initCode: HexDataOrEmptySchema,
  callData: HexDataOrEmptySchema,
  callGasLimit: BigIntFromNumberishSchema,
  verificationGasLimit: BigIntFromNumberishSchema,
  preVerificationGas: BigIntFromNumberishSchema,
  maxFeePerGas: BigIntFromNumberishSchema,
  maxPriorityFeePerGas: BigIntFromNumberishSchema,
  paymasterAndData: HexDataOrEmptySchema,
  signature: HexDataOrEmptySchema,
});

export const AaUserOpDraftSchema = z.object({
  owner: HexAddressSchema,
  userOp: UserOperationSchema,
  entryPointAddress: HexAddressSchema.optional(),
});

export const AaUserOpSimulateSchema = z.object({
  owner: HexAddressSchema,
  userOp: UserOperationSchema,
  entryPointAddress: HexAddressSchema.optional(),
});

export const AaUserOpSubmitSchema = z.object({
  owner: HexAddressSchema,
  userOp: z.any(),
  signature: HexDataOrEmptySchema.optional(),
  entryPointAddress: HexAddressSchema.optional(),
});

export const CustodialSignSchema = z.object({
  userOp: z.any(),
  owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const OrderInputSchema = z.object({
  marketKey: z.string().min(1),
  maker: HexAddressSchema,
  outcomeIndex: z.number().int().min(0),
  isBuy: z.boolean(),
  price: BigIntFromNumberishSchema,
  amount: BigIntFromNumberishSchema,
  salt: z.string().min(1),
  expiry: z.number().int().min(0),
  signature: HexDataSchema,
  chainId: z.number().int().positive(),
  verifyingContract: HexAddressSchema,
  tif: z.enum(["GTC", "IOC", "FOK", "FAK", "GTD"]).optional(),
  postOnly: z.boolean().optional(),
  clientOrderId: z.string().min(1).max(128).optional(),
});

export const CancelV2Schema = z
  .object({
    marketKey: z.string().min(1),
    outcomeIndex: z
      .preprocess(
        (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
        z.number().int().min(0)
      )
      .optional(),
    outcome_index: z
      .preprocess(
        (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
        z.number().int().min(0)
      )
      .optional(),
    chainId: z.preprocess(
      (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
      z.number().int().positive()
    ),
    verifyingContract: z.string().optional(),
    verifying_contract: z.string().optional(),
    verifying_contract_address: z.string().optional(),
    contract: z.string().optional(),
    contractAddress: z.string().optional(),
    ownerEoa: z.string().optional(),
    owner_eoa: z.string().optional(),
    maker: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    salt: z.preprocess((v) => (typeof v === "string" ? v : String(v)), z.string().min(1)),
    signature: HexDataSchema,
  })
  .refine((v) => typeof v.outcomeIndex === "number" || typeof v.outcome_index === "number", {
    message: "outcomeIndex is required",
    path: ["outcomeIndex"],
  })
  .transform((v) => ({
    marketKey: v.marketKey,
    outcomeIndex: (v.outcomeIndex ?? v.outcome_index) as number,
    chainId: v.chainId,
    verifyingContract:
      v.verifyingContract ||
      v.verifying_contract ||
      v.verifying_contract_address ||
      v.contract ||
      v.contractAddress ||
      "",
    ownerEoa: v.ownerEoa || v.owner_eoa,
    maker: v.maker,
    salt: v.salt,
    signature: v.signature,
  }))
  .refine((v) => /^0x[0-9a-fA-F]{40}$/.test(v.verifyingContract), {
    message: "Invalid verifyingContract",
    path: ["verifyingContract"],
  });

export const V2DepthQuerySchema = z.object({
  marketKey: z.string().min(1),
  outcomeIndex: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  levels: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 20;
    return Math.max(1, Math.min(50, n));
  }, z.number().int().min(1).max(50)),
});

export const V2StatsQuerySchema = z.object({
  marketKey: z.string().min(1),
  outcomeIndex: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
});

export const V2RegisterSettlerSchema = z.object({
  marketKey: z.string().min(1),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  marketAddress: HexAddressSchema,
});

export const V2CloseMarketSchema = z.object({
  marketKey: z.string().min(1),
  reason: z.string().optional(),
});

export const DepthQuerySchema = z.object({
  contract: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((v) => v.toLowerCase()),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  outcome: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  side: z
    .string()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "buy" || v === "sell", {
      message: "side must be buy or sell",
    }),
  levels: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 10;
    return Math.max(1, Math.min(50, n));
  }, z.number().int().min(1).max(50)),
  marketKey: z.string().optional(),
  market_key: z.string().optional(),
});

export const QueueQuerySchema = z.object({
  contract: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((v) => v.toLowerCase()),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  outcome: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  side: z
    .string()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "buy" || v === "sell", {
      message: "side must be buy or sell",
    }),
  price: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? BigInt(String(v)) : v),
    z.bigint()
  ),
  limit: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 50;
    return Math.max(1, Math.min(200, n));
  }, z.number().int().min(1).max(200)),
  offset: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
  }, z.number().int().min(0)),
  marketKey: z.string().optional(),
  market_key: z.string().optional(),
});

export const CandlesQuerySchema = z.object({
  market: z.string(),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  outcome: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  resolution: z.string().default("15m"),
  limit: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 100;
    return Math.max(1, Math.min(1000, n));
  }, z.number().int().min(1).max(1000)),
});

export const TradeReportSchema = z.object({
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});
