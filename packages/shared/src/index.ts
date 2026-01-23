export * from "./api.js";
export * from "./order.js";
export * from "./error.js";

import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function calculatePaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
  };
}

export interface User {
  id: string;
  email: string | null;
  username?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Market {
  id: number;
  chainId: number;
  verifyingContract: string;
  collateralToken: string;
  oracleAddress: string;
  feeBps: number;
  resolutionTime: number;
  createdAt: string;
  updatedAt: string;
}
