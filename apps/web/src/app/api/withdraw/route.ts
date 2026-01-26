import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import {
  getSessionAddress,
  isAdminAddress,
  logApiError,
  normalizeAddress,
} from "@/lib/serverUtils";
import { getChainAddresses, getConfiguredChainId, getConfiguredRpcUrl } from "@/lib/runtimeConfig";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import { erc20Abi } from "@/app/prediction/[id]/_lib/abis";

interface WithdrawRequest {
  amount: string;
  destination?: string;
}

interface WithdrawResponse {
  success: boolean;
  transactionHash?: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    // 1. 获取当前用户地址
    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) {
      return ApiResponses.unauthorized("未登录");
    }

    // 2. 检查请求频率
    const ip = getIP(req);
    const rl = await checkRateLimit(
      `withdraw:${viewer.toLowerCase()}:${ip || "unknown"}`,
      RateLimits.moderate,
      "withdraw"
    );
    if (!rl.success) return ApiResponses.rateLimit("请求过于频繁，请稍后再试");

    // 3. 解析请求体
    const body = (await req.json()) as WithdrawRequest;
    if (!body.amount || parseFloat(body.amount) <= 0) {
      return ApiResponses.badRequest("无效的取款金额");
    }

    // 4. 获取用户配置文件
    const { data: profile, error: profileError } = await client
      .from("user_profiles")
      .select("proxy_wallet_address")
      .eq("wallet_address", viewer)
      .maybeSingle();

    if (profileError) {
      logApiError("Failed to get user profile", profileError);
      return ApiResponses.databaseError("Failed to get user profile");
    }

    // 类型断言，告诉TypeScript profile可能具有proxy_wallet_address属性
    const proxyWalletAddress = (profile as any)?.proxy_wallet_address;
    if (!proxyWalletAddress) {
      return ApiResponses.badRequest("代理钱包地址未配置");
    }

    // 5. 配置链和合约
    const configuredChainId = getConfiguredChainId();
    const rpcUrl = getConfiguredRpcUrl(configuredChainId);
    const usdcAddress = getChainAddresses(configuredChainId).usdc;

    if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
      return ApiResponses.internalError("USDC address not configured");
    }

    // 6. 计算取款金额和手续费
    const FEE_RATE = 0.001; // 0.1% 手续费
    const amountNum = parseFloat(body.amount);
    const feeNum = amountNum * FEE_RATE;
    const totalAmountNum = amountNum + feeNum;

    const amountEth = ethers.parseUnits(body.amount, 6); // USDC has 6 decimals
    const feeEth = ethers.parseUnits(feeNum.toFixed(6), 6);
    const totalAmountEth = amountEth + feeEth;

    const destination = body.destination || viewer;

    if (!ethers.isAddress(destination)) {
      return ApiResponses.badRequest("无效的目标地址");
    }

    // 7. 创建Provider和合约实例
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tokenContract = new ethers.Contract(usdcAddress, erc20Abi, provider);

    // 8. 检查钱包余额（包括手续费）
    const balance = await tokenContract.balanceOf(proxyWalletAddress);
    if (balance < totalAmountEth) {
      return ApiResponses.badRequest("余额不足，无法支付取款金额和手续费");
    }

    // 9. 构建取款交易
    const withdrawData = tokenContract.interface.encodeFunctionData("transfer", [
      destination,
      amountEth,
    ]);

    // 10. 执行取款操作（使用模拟交易）
    let transactionHash: string;

    try {
      // 生成模拟交易哈希
      transactionHash = `0x${Math.random().toString(16).slice(2, 66)}`;

      // 11. 记录取款历史（包含手续费）
      await (client.from("withdrawals") as any).insert({
        user_address: viewer,
        proxy_wallet_address: proxyWalletAddress,
        destination_address: destination,
        amount: body.amount,
        fee: feeNum.toFixed(6),
        total_amount: totalAmountNum.toFixed(6),
        transaction_hash: transactionHash,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      // 12. 更新用户余额（扣除取款金额和手续费）
      const updatedBalance = ethers.formatUnits(balance - totalAmountEth, 6);
      await (client.from("user_balances") as any).upsert(
        {
          user_address: proxyWalletAddress,
          balance: updatedBalance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_address" }
      );

      return successResponse({
        success: true,
        transactionHash,
        message: "取款请求已提交",
      });
    } catch (error) {
      logApiError("Failed to execute withdrawal", error as Error);
      return ApiResponses.internalError("执行取款失败");
    }
  } catch (e) {
    const error = e as Error;
    logApiError("POST /api/withdraw unhandled error", error);
    return ApiResponses.internalError("处理取款请求失败", error?.message || String(error));
  }
}

export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    // 获取当前用户地址
    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) {
      return ApiResponses.unauthorized("未登录");
    }

    // 获取用户的代理钱包地址
    const { data: profile } = await client
      .from("user_profiles")
      .select("proxy_wallet_address")
      .eq("wallet_address", viewer)
      .maybeSingle();

    // 类型断言，告诉TypeScript profile可能具有proxy_wallet_address属性
    if (!(profile as any)?.proxy_wallet_address) {
      return successResponse({ withdrawals: [] });
    }

    // 获取取款历史记录
    const profileWithProxy = profile as any;
    const { data: withdrawals, error } = await (client.from("withdrawals") as any)
      .select("*")
      .eq("user_address", viewer)
      .or(`proxy_wallet_address.eq.${profileWithProxy.proxy_wallet_address}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      logApiError("Failed to get withdrawal history", error);
      return ApiResponses.databaseError("获取取款历史失败");
    }

    return successResponse({ withdrawals: withdrawals || [] });
  } catch (e) {
    const error = e as Error;
    logApiError("GET /api/withdraw unhandled error", error);
    return ApiResponses.internalError("获取取款历史失败", error?.message || String(error));
  }
}
