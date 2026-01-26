import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { getSessionAddress, logApiError, normalizeAddress } from "@/lib/serverUtils";
import { getChainAddresses, getConfiguredChainId, getConfiguredRpcUrl } from "@/lib/runtimeConfig";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import { erc20Abi } from "@/app/prediction/[id]/_lib/abis";

const FEE_RATE = 0.001;
const TRANSACTION_TIMEOUT_MS = 120000;

interface WithdrawRequest {
  amount: string;
  destination?: string;
}

interface WithdrawConfirmRequest {
  withdrawId: string;
  transactionHash: string;
}

async function getUserProxyInfo(
  client: NonNullable<Awaited<typeof supabaseAdmin>>,
  viewer: string
): Promise<{ proxyWalletAddress: string; proxyWalletType: string } | null> {
  const { data: profile, error } = await client
    .from("user_profiles")
    .select("proxy_wallet_address, proxy_wallet_type")
    .eq("wallet_address", viewer)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  const typedProfile = profile as {
    proxy_wallet_address: string | null;
    proxy_wallet_type: string | null;
  };
  return {
    proxyWalletAddress: normalizeAddress(String(typedProfile.proxy_wallet_address || "")),
    proxyWalletType: String(typedProfile.proxy_wallet_type || "safe").toLowerCase(),
  };
}

async function createWithdrawRecord(
  client: NonNullable<Awaited<typeof supabaseAdmin>>,
  params: {
    userAddress: string;
    proxyWalletAddress: string;
    destinationAddress: string;
    amount: string;
    fee: string;
    totalAmount: string;
  }
): Promise<{ id: string; transactionHash: string }> {
  const txHashBytes = ethers.randomBytes(32);
  const transactionHash =
    "0x" +
    Array.from(txHashBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const { data, error } = await (client.from("withdrawals") as any)
    .insert({
      user_address: params.userAddress,
      proxy_wallet_address: params.proxyWalletAddress,
      destination_address: params.destinationAddress,
      amount: params.amount,
      fee: params.fee,
      total_amount: params.totalAmount,
      transaction_hash: transactionHash,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select("id, transaction_hash")
    .single();

  if (error) {
    throw new Error(`Failed to create withdraw record: ${error.message}`);
  }

  return { id: String(data.id), transactionHash };
}

async function updateWithdrawStatus(
  client: NonNullable<Awaited<typeof supabaseAdmin>>,
  withdrawId: string,
  status: string,
  transactionHash?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (transactionHash) {
    updateData.transaction_hash = transactionHash;
  }

  const { error } = await (client.from("withdrawals") as any)
    .update(updateData)
    .eq("id", withdrawId);

  if (error) {
    throw new Error(`Failed to update withdraw status: ${error.message}`);
  }
}

async function syncBalance(
  client: NonNullable<Awaited<typeof supabaseAdmin>>,
  proxyWalletAddress: string,
  newBalance: string
): Promise<void> {
  const { error } = await (client.from("user_balances") as any).upsert(
    {
      user_address: proxyWalletAddress,
      balance: newBalance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_address" }
  );

  if (error) {
    throw new Error(`Failed to sync balance: ${error.message}`);
  }
}

async function verifyTransactionOnChain(
  rpcUrl: string,
  usdcAddress: string,
  proxyWalletAddress: string,
  destinationAddress: string,
  amountEth: bigint,
  expectedTransactionHash: string
): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tokenContract = new ethers.Contract(usdcAddress, erc20Abi, provider);

    const txReceipt = await provider.waitForTransaction(
      expectedTransactionHash,
      1,
      TRANSACTION_TIMEOUT_MS / 1000
    );

    if (!txReceipt || txReceipt.status !== 1) {
      return false;
    }

    const transferFilter = tokenContract.filters.Transfer(proxyWalletAddress, destinationAddress);
    const transferEvents = await tokenContract.queryFilter(
      transferFilter,
      txReceipt.blockNumber,
      txReceipt.blockNumber
    );

    for (const event of transferEvents) {
      const eventLog = event as unknown as { args: [from: string, to: string, value: bigint] };
      const args = eventLog.args;
      if (args && args[1].toLowerCase() === destinationAddress.toLowerCase()) {
        const transferAmount = args[2];
        if (transferAmount >= amountEth) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Transaction verification failed:", error);
    return false;
  }
}

function buildTransferData(destination: string, amountEth: bigint): string {
  const tokenInterface = new ethers.Interface(erc20Abi);
  return tokenInterface.encodeFunctionData("transfer", [destination, amountEth]);
}

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) {
      return ApiResponses.unauthorized("未登录");
    }

    const ip = getIP(req);
    const rl = await checkRateLimit(
      `withdraw:${viewer.toLowerCase()}:${ip || "unknown"}`,
      RateLimits.moderate,
      "withdraw"
    );
    if (!rl.success) return ApiResponses.rateLimit("请求过于频繁，请稍后再试");

    const body = (await req.json()) as WithdrawRequest;
    if (!body.amount || parseFloat(body.amount) <= 0) {
      return ApiResponses.badRequest("无效的取款金额");
    }

    const proxyInfo = await getUserProxyInfo(client, viewer);
    if (!proxyInfo?.proxyWalletAddress) {
      return ApiResponses.badRequest("代理钱包地址未配置");
    }

    const configuredChainId = getConfiguredChainId();
    const rpcUrl = getConfiguredRpcUrl(configuredChainId);
    const usdcAddress = getChainAddresses(configuredChainId).usdc;

    if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
      return ApiResponses.internalError("USDC address not configured");
    }

    const amountNum = parseFloat(body.amount);
    const feeNum = amountNum * FEE_RATE;
    const totalAmountNum = amountNum + feeNum;

    const amountEth = ethers.parseUnits(body.amount, 6);
    const feeEth = ethers.parseUnits(feeNum.toFixed(6), 6);
    const totalAmountEth = amountEth + feeEth;

    const destination = body.destination || viewer;
    if (!ethers.isAddress(destination)) {
      return ApiResponses.badRequest("无效的目标地址");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tokenContract = new ethers.Contract(usdcAddress, erc20Abi, provider);

    const balance = await tokenContract.balanceOf(proxyInfo.proxyWalletAddress);
    if (balance < totalAmountEth) {
      return ApiResponses.badRequest("余额不足，无法支付取款金额和手续费");
    }

    const withdrawRecord = await createWithdrawRecord(client, {
      userAddress: viewer,
      proxyWalletAddress: proxyInfo.proxyWalletAddress,
      destinationAddress: destination,
      amount: body.amount,
      fee: feeNum.toFixed(6),
      totalAmount: totalAmountNum.toFixed(6),
    });

    const transferData = buildTransferData(destination, amountEth);

    return successResponse({
      success: true,
      withdrawId: withdrawRecord.id,
      transactionData: transferData,
      amount: body.amount,
      fee: feeNum.toFixed(6),
      tokenAddress: usdcAddress,
      proxyWalletAddress: proxyInfo.proxyWalletAddress,
      proxyWalletType: proxyInfo.proxyWalletType,
      message: "取款请求已创建，请在钱包中确认交易",
    });
  } catch (e) {
    const error = e as Error;
    logApiError("POST /api/withdraw unhandled error", error);
    return ApiResponses.internalError("处理取款请求失败", error?.message || String(error));
  }
}

export async function PUT(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) {
      return ApiResponses.unauthorized("未登录");
    }

    const body = (await req.json()) as WithdrawConfirmRequest;
    if (!body.withdrawId || !body.transactionHash) {
      return ApiResponses.badRequest("缺少取款确认信息");
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(body.transactionHash)) {
      return ApiResponses.badRequest("无效的交易哈希格式");
    }

    const { data: withdrawRecord, error: fetchError } = await (client.from("withdrawals") as any)
      .select("*")
      .eq("id", body.withdrawId)
      .eq("user_address", viewer)
      .single();

    if (fetchError || !withdrawRecord) {
      return ApiResponses.notFound("取款记录不存在");
    }

    if (withdrawRecord.status !== "pending") {
      return ApiResponses.badRequest("该取款请求已被处理");
    }

    const configuredChainId = getConfiguredChainId();
    const rpcUrl = getConfiguredRpcUrl(configuredChainId);
    const usdcAddress = getChainAddresses(configuredChainId).usdc;

    if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
      return ApiResponses.internalError("USDC address not configured");
    }

    const amountEth = ethers.parseUnits(String(withdrawRecord.amount), 6);
    const isVerified = await verifyTransactionOnChain(
      rpcUrl,
      usdcAddress,
      String(withdrawRecord.proxy_wallet_address),
      String(withdrawRecord.destination_address),
      amountEth,
      body.transactionHash
    );

    if (!isVerified) {
      await updateWithdrawStatus(client, body.withdrawId, "failed");
      return ApiResponses.badRequest("交易验证失败，请稍后重试或联系客服");
    }

    await updateWithdrawStatus(client, body.withdrawId, "confirmed", body.transactionHash);

    const newBalanceEth = BigInt(
      await new ethers.Contract(
        usdcAddress,
        erc20Abi,
        new ethers.JsonRpcProvider(rpcUrl)
      ).balanceOf(String(withdrawRecord.proxy_wallet_address))
    );
    await syncBalance(
      client,
      String(withdrawRecord.proxy_wallet_address),
      ethers.formatUnits(newBalanceEth, 6)
    );

    return successResponse({
      success: true,
      transactionHash: body.transactionHash,
      message: "取款已确认，资金已转出",
    });
  } catch (e) {
    const error = e as Error;
    logApiError("PUT /api/withdraw unhandled error", error);
    return ApiResponses.internalError("确认取款失败", error?.message || String(error));
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
