import { ethers } from "ethers";
import type { OrderInput } from "./matchingEngine.js";
import { supabaseAdmin } from "../supabase.js";
import type { MatchingEngineConfig } from "./types.js";

// 内部函数: 获取配置的USDC地址
function getConfiguredUsdcAddress(): string | undefined {
  const pickFirstNonEmptyString = (...values: unknown[]): string | undefined => {
    for (const v of values) {
      const s = typeof v === "string" ? v.trim() : "";
      if (s) return s;
    }
    return undefined;
  };
  return pickFirstNonEmptyString(
    process.env.COLLATERAL_TOKEN_ADDRESS,
    process.env.USDC_ADDRESS,
    process.env.NEXT_PUBLIC_USDC_ADDRESS,
    process.env.NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS
  );
}

// 内部函数: 获取配置的结果代币地址
function getConfiguredOutcomeTokenAddress(): string | undefined {
  const pickFirstNonEmptyString = (...values: unknown[]): string | undefined => {
    for (const v of values) {
      const s = typeof v === "string" ? v.trim() : "";
      if (s) return s;
    }
    return undefined;
  };
  return pickFirstNonEmptyString(
    process.env.OUTCOME1155_ADDRESS,
    process.env.OUTCOME_TOKEN1155_ADDRESS,
    process.env.NEXT_PUBLIC_OUTCOME_TOKEN_ADDRESS,
    process.env.NEXT_PUBLIC_OUTCOME1155_ADDRESS
  );
}

// 内部函数: 获取RPC提供者
const providerByChainId = new Map<number, ethers.JsonRpcProvider>();
function getRpcProvider(chainId: number): ethers.JsonRpcProvider {
  const pickFirstNonEmptyString = (...values: unknown[]): string | undefined => {
    for (const v of values) {
      const s = typeof v === "string" ? v.trim() : "";
      if (s) return s;
    }
    return undefined;
  };

  function getConfiguredRpcUrl(chainId: number): string {
    const generic = pickFirstNonEmptyString(process.env.RPC_URL, process.env.NEXT_PUBLIC_RPC_URL);
    if (generic) return generic;

    if (chainId === 80002) {
      return (
        pickFirstNonEmptyString(
          process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
          "https://rpc-amoy.polygon.technology/"
        ) || "https://rpc-amoy.polygon.technology/"
      );
    }
    if (chainId === 137) {
      return (
        pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_POLYGON, "https://polygon-rpc.com") ||
        "https://polygon-rpc.com"
      );
    }
    if (chainId === 11155111) {
      return (
        pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_SEPOLIA, "https://rpc.sepolia.org") ||
        "https://rpc.sepolia.org"
      );
    }

    return "http://127.0.0.1:8545";
  }
  const cached = providerByChainId.get(chainId);
  if (cached) return cached;
  const provider = new ethers.JsonRpcProvider(getConfiguredRpcUrl(chainId));
  providerByChainId.set(chainId, provider);
  return provider;
}

// 内部函数: 格式化USDC单位（从micro到正常）
function formatUsdcUnitsFromMicro(usdcMicro: bigint): string {
  return ethers.formatUnits(usdcMicro, 6);
}

// 内部函数: 解析USDC单位（从正常到micro）
function parseUsdcUnitsToMicro(raw: unknown): bigint {
  let numeric = 0;
  if (typeof raw === "number") {
    numeric = raw;
  } else if (typeof raw === "string") {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) numeric = parsed;
  }
  if (!Number.isFinite(numeric) || numeric <= 0) return 0n;
  return BigInt(Math.floor(numeric * 1e6));
}

// 内部函数: 计算订单的USDC价值
function orderNotionalUsdc(amount: bigint, price: bigint): bigint {
  if (amount <= 0n || price <= 0n) return 0n;
  return (amount * price) / 1_000_000_000_000_000_000n;
}

/**
 * 检查余额和风险
 */
export async function checkBalanceAndRisk(
  input: OrderInput,
  config: MatchingEngineConfig,
  exposure?: { marketLongUsdc?: bigint; marketShortUsdc?: bigint }
): Promise<{ valid: boolean; error?: string; errorCode?: string }> {
  try {
    const makerAddress = input.maker.toLowerCase();

    const orderCostUsdc = (input.amount * input.price) / 1_000_000_000_000_000_000n;

    // 检查市场暴露限制
    if (config.maxMarketLongExposureUsdc && config.maxMarketLongExposureUsdc > 0) {
      const limitUsdc = BigInt(Math.floor(config.maxMarketLongExposureUsdc * 1e6));
      const currentLongUsdc = exposure?.marketLongUsdc ?? 0n;
      const newLongExposure = currentLongUsdc + (input.isBuy ? orderCostUsdc : 0n);
      if (newLongExposure > limitUsdc) {
        return {
          valid: false,
          error: "Market long exposure limit exceeded",
          errorCode: "MARKET_LONG_EXPOSURE_LIMIT",
        };
      }
    }

    if (config.maxMarketShortExposureUsdc && config.maxMarketShortExposureUsdc > 0) {
      const limitUsdc = BigInt(Math.floor(config.maxMarketShortExposureUsdc * 1e6));
      const currentShortUsdc = exposure?.marketShortUsdc ?? 0n;
      const newShortExposure = currentShortUsdc + (!input.isBuy ? orderCostUsdc : 0n);
      if (newShortExposure > limitUsdc) {
        return {
          valid: false,
          error: "Market short exposure limit exceeded",
          errorCode: "MARKET_SHORT_EXPOSURE_LIMIT",
        };
      }
    }

    if (!supabaseAdmin) {
      return { valid: true };
    }

    // 检查结果代币余额（对于卖出订单）
    if (!input.isBuy) {
      const outcomeTokenAddress = getConfiguredOutcomeTokenAddress();
      if (!outcomeTokenAddress || !ethers.isAddress(outcomeTokenAddress)) {
        return {
          valid: false,
          error: "Outcome token not configured",
          errorCode: "BALANCE_CHECK_FAILED",
        };
      }

      const { data: openOrders } = await supabaseAdmin
        .from("orders")
        .select("remaining")
        .eq("maker_address", makerAddress)
        .eq("is_buy", false)
        .in("status", ["open", "partially_filled"]);

      let reservedOutcome = 0n;
      for (const row of openOrders || []) {
        reservedOutcome += BigInt((row as any).remaining);
      }

      const totalRequiredOutcome = reservedOutcome + input.amount;

      try {
        const provider = getRpcProvider(input.chainId);
        const outcome1155 = new ethers.Contract(
          outcomeTokenAddress,
          [
            "function balanceOf(address account, uint256 id) view returns (uint256)",
            "function isApprovedForAll(address account, address operator) view returns (bool)",
            "function computeTokenId(address market, uint256 outcomeIndex) view returns (uint256)",
          ],
          provider
        );

        const tokenId = BigInt(
          await outcome1155.computeTokenId(input.verifyingContract, input.outcomeIndex)
        );
        const balance = BigInt(await outcome1155.balanceOf(makerAddress, tokenId));
        const approved = Boolean(
          await outcome1155.isApprovedForAll(makerAddress, input.verifyingContract)
        );

        if (!approved) {
          return {
            valid: false,
            error: "Outcome token not approved",
            errorCode: "BALANCE_CHECK_FAILED",
          };
        }

        if (totalRequiredOutcome > balance) {
          return {
            valid: false,
            error: "Insufficient outcome token balance",
            errorCode: "INSUFFICIENT_BALANCE",
          };
        }

        return { valid: true };
      } catch {
        return { valid: false, error: "Balance check failed", errorCode: "BALANCE_CHECK_FAILED" };
      }
    }

    // 检查USDC余额（对于买入订单）
    let balanceRow: any = null;
    try {
      const res = await supabaseAdmin
        .from("user_balances")
        .select("balance,reserved")
        .eq("user_address", makerAddress)
        .maybeSingle();
      if (!res.error) balanceRow = res.data;
    } catch {
      try {
        const res = await supabaseAdmin
          .from("user_balances")
          .select("balance")
          .eq("user_address", makerAddress)
          .maybeSingle();
        if (!res.error) balanceRow = res.data;
      } catch {}
    }

    const offchainBalanceUsdc = balanceRow ? parseUsdcUnitsToMicro(balanceRow.balance) : 0n;
    const ledgerReservedUsdc =
      balanceRow && "reserved" in balanceRow ? parseUsdcUnitsToMicro(balanceRow.reserved) : null;

    let reservedUsdc = 0n;
    if (ledgerReservedUsdc !== null) {
      reservedUsdc = ledgerReservedUsdc;
      const reconcileEnabled =
        String(process.env.RELAYER_RESERVED_RECONCILE_ENABLED || "true").toLowerCase() !== "false";
      if (reconcileEnabled) {
        const { data: openOrders } = await supabaseAdmin
          .from("orders")
          .select("price, remaining")
          .eq("maker_address", makerAddress)
          .eq("is_buy", true)
          .in("status", ["open", "partially_filled"]);

        let computed = 0n;
        for (const row of openOrders || []) {
          const price = BigInt((row as any).price);
          const remaining = BigInt((row as any).remaining);
          computed += orderNotionalUsdc(remaining, price);
        }

        if (computed > reservedUsdc) reservedUsdc = computed;
      }
    } else {
      const { data: openOrders } = await supabaseAdmin
        .from("orders")
        .select("price, remaining")
        .eq("maker_address", makerAddress)
        .eq("is_buy", true)
        .in("status", ["open", "partially_filled"]);

      for (const row of openOrders || []) {
        const price = BigInt((row as any).price);
        const remaining = BigInt((row as any).remaining);
        reservedUsdc += orderNotionalUsdc(remaining, price);
      }
    }

    const totalRequiredUsdc = reservedUsdc + orderCostUsdc;

    if (totalRequiredUsdc > offchainBalanceUsdc) {
      const usdcAddress = getConfiguredUsdcAddress();
      if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
        return {
          valid: false,
          error: "Insufficient balance",
          errorCode: "INSUFFICIENT_BALANCE",
        };
      }

      try {
        const provider = getRpcProvider(input.chainId);
        const usdc = new ethers.Contract(
          usdcAddress,
          ["function balanceOf(address account) view returns (uint256)"],
          provider
        );
        const onchainBalanceUsdc = BigInt(await usdc.balanceOf(makerAddress));

        if (totalRequiredUsdc <= onchainBalanceUsdc) {
          try {
            await supabaseAdmin.from("user_balances").upsert(
              {
                user_address: makerAddress,
                balance: ethers.formatUnits(onchainBalanceUsdc, 6),
              },
              { onConflict: "user_address" }
            );
          } catch {}

          return { valid: true };
        }
      } catch {}

      return { valid: false, error: "Insufficient balance", errorCode: "INSUFFICIENT_BALANCE" };
    }

    return { valid: true };
  } catch (error: any) {
    console.error("[RiskManagement] Balance check failed", error);
    return { valid: false, error: "Balance check failed", errorCode: "BALANCE_CHECK_FAILED" };
  }
}

/**
 * 预留USDC余额
 */
export async function reserveUsdcForOrder(order: any): Promise<bigint> {
  if (!supabaseAdmin) return 0n;
  if (!order.isBuy) return 0n;
  const reserveMicro = orderNotionalUsdc(order.remainingAmount, order.price);
  if (reserveMicro <= 0n) return 0n;

  try {
    const { data, error } = await supabaseAdmin.rpc("reserve_user_balance", {
      p_user_address: order.maker,
      p_amount: formatUsdcUnitsFromMicro(reserveMicro),
    });
    if (error) {
      const code = String((error as any).code || "");
      if (code === "42883") return 0n;
      return -1n;
    }
    const row = Array.isArray(data) ? (data[0] as any) : (data as any);
    const ok = row && (row.success === true || row.success === "true");
    return ok ? reserveMicro : -1n;
  } catch {
    return 0n;
  }
}

/**
 * 释放USDC余额
 */
export async function releaseUsdcReservation(maker: string, amountMicro: bigint): Promise<void> {
  if (!supabaseAdmin) return;
  if (amountMicro <= 0n) return;
  try {
    const { error } = await supabaseAdmin.rpc("release_user_balance", {
      p_user_address: maker,
      p_amount: formatUsdcUnitsFromMicro(amountMicro),
    });
    if (error) {
      const code = String((error as any).code || "");
      if (code === "42883") return;
    }
  } catch {}
}

/**
 * 最终确定USDC余额预留
 */
export async function finalizeUsdcReservationAfterSubmit(
  order: any,
  reservedAtStartUsdc: bigint,
  result: any
): Promise<void> {
  if (!order.isBuy) return;
  if (reservedAtStartUsdc <= 0n) return;
  if (!result.success) {
    await releaseUsdcReservation(order.maker, reservedAtStartUsdc);
    return;
  }

  let matchedAmount = 0n;
  for (const m of result.matches || []) {
    matchedAmount += m.matchedAmount;
  }

  const matchedMicro =
    matchedAmount > 0n
      ? (() => {
          let total = 0n;
          for (const m of result.matches || []) {
            total += orderNotionalUsdc(m.matchedAmount, m.matchedPrice);
          }
          return total;
        })()
      : 0n;

  const remaining = result.remainingOrder?.remainingAmount ?? 0n;
  const remainingMicro = remaining > 0n ? orderNotionalUsdc(remaining, order.price) : 0n;
  const keepMicro = matchedMicro + remainingMicro;
  const releaseMicro = reservedAtStartUsdc - keepMicro;
  if (releaseMicro > 0n) {
    await releaseUsdcReservation(order.maker, releaseMicro);
  }
}
