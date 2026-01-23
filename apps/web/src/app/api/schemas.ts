import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const addressParamSchema = z.object({
  address: z.string().startsWith("0x").length(42),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const orderIdParamSchema = z.object({
  orderId: z.string(),
});

export const marketKeyParamSchema = z.object({
  marketKey: z.string(),
});

export const categoryQuerySchema = z.object({
  category: z.string().optional(),
  status: z.enum(["open", "closed", "resolved"]).optional(),
});

export const timeRangeQuerySchema = z.object({
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
});

export const orderCreateSchema = z.object({
  marketKey: z.string(),
  outcomeIndex: z.number().int().min(0),
  isBuy: z.boolean(),
  price: z.string().regex(/^\d+$/),
  amount: z.string().regex(/^\d+$/),
  salt: z.string(),
  expiry: z.number().int().nonnegative(),
  signature: z.string(),
  tif: z.enum(["IOC", "FOK", "FAK", "GTC", "GTD"]).optional(),
  postOnly: z.boolean().optional(),
});

export const orderCancelSchema = z.object({
  orderId: z.string(),
  marketKey: z.string(),
  salt: z.string(),
});

export const depthQuerySchema = z.object({
  marketKey: z.string(),
  outcomeIndex: z.coerce.number().int().min(0),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const candlesQuerySchema = z.object({
  marketKey: z.string(),
  outcomeIndex: z.coerce.number().int().min(0),
  interval: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]).default("1h"),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

export const tradesQuerySchema = z.object({
  marketKey: z.string().optional(),
  outcomeIndex: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const userOrdersQuerySchema = z.object({
  address: z.string().startsWith("0x").length(42),
  status: z.enum(["open", "filled", "cancelled"]).optional(),
  marketKey: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const predictionCreateSchema = z.object({
  marketKey: z.string(),
  outcomeIndex: z.number().int().min(0),
  amount: z.string().regex(/^\d+$/),
  salt: z.string(),
  signature: z.string(),
});

export const emailOtpRequestSchema = z.object({
  email: z.string().email(),
  mode: z.enum(["login", "signup"]),
});

export const emailOtpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  mode: z.enum(["login", "signup"]),
});

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
});

export const apiKeyResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  permissions: z.array(z.string()),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  lastUsedAt: z.string().optional(),
});

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.record(z.unknown()).optional(),
    timestamp: z.string(),
  }),
});

export const successResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
    meta: z
      .object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      })
      .optional(),
  });

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderCancelInput = z.infer<typeof orderCancelSchema>;
export type DepthQuery = z.infer<typeof depthQuerySchema>;
export type CandlesQuery = z.infer<typeof candlesQuerySchema>;
export type TradesQuery = z.infer<typeof tradesQuerySchema>;
export type UserOrdersQuery = z.infer<typeof userOrdersQuerySchema>;
export type EmailOtpRequest = z.infer<typeof emailOtpRequestSchema>;
export type EmailOtpVerify = z.infer<typeof emailOtpVerifySchema>;
export type ApiKeyCreate = z.infer<typeof apiKeyCreateSchema>;
