import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { getSessionAddress, normalizeAddress, logApiError } from "@/lib/serverUtils";
import { supabaseAdmin } from "@/lib/supabase.server";
import { getConfiguredRpcUrl, getConfiguredChainId, getChainAddresses } from "@/lib/runtimeConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Item = {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  value: string;
  valueFormatted: string;
  timestamp?: number;
};

const transferIface = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

function withNoStore<T>(res: import("next/server").NextResponse<T>) {
  try {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
  } catch {}
  return res;
}

function toTopicAddress(addr: string) {
  try {
    return ethers.zeroPadValue(addr, 32);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const baseAddrRaw = await getSessionAddress(req);
    const baseAddress = normalizeAddress(baseAddrRaw);
    if (!baseAddress) {
      return withNoStore(ApiResponses.unauthorized("未登录或会话已过期"));
    }

    const chainId = getConfiguredChainId();
    const addresses = getChainAddresses(chainId);
    const usdcAddress = String(addresses.usdc || "").trim();
    if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
      return withNoStore(ApiResponses.internalError("USDC 地址未配置"));
    }

    const client = supabaseAdmin as any;
    if (!client) {
      return withNoStore(ApiResponses.internalError("Supabase 未配置"));
    }

    const { data: prof, error: profErr } = await client
      .from("user_profiles")
      .select("wallet_address, proxy_wallet_address")
      .eq("wallet_address", baseAddress)
      .maybeSingle();

    if (profErr) {
      return withNoStore(
        ApiResponses.databaseError("Failed to load user profile", profErr.message)
      );
    }

    const proxyAddress = normalizeAddress(String((prof as any)?.proxy_wallet_address || ""));
    if (!proxyAddress || !ethers.isAddress(proxyAddress)) {
      return withNoStore(ApiResponses.badRequest("Proxy wallet 未初始化，请先打开入金弹窗初始化"));
    }

    const toTopic = toTopicAddress(proxyAddress);
    if (!toTopic) return withNoStore(ApiResponses.invalidParameters("入金地址无效"));

    const url = new URL(req.url);
    const windowBlocksRaw = Number(url.searchParams.get("window") || "");
    const windowBlocks =
      Number.isFinite(windowBlocksRaw) && windowBlocksRaw > 0
        ? Math.min(windowBlocksRaw, 200000)
        : 50000;
    const limitRaw = Number(url.searchParams.get("limit") || "");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;

    const rpcUrl = getConfiguredRpcUrl(chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - windowBlocks);

    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const logs = await provider.getLogs({
      address: usdcAddress,
      fromBlock,
      toBlock: latest,
      topics: [transferTopic, null, toTopic],
    });

    const sorted = logs
      .map((l) => ({
        ...l,
        blockNumber: Number(l.blockNumber || 0),
        logIndex: Number((l as any).index ?? (l as any).logIndex ?? 0),
      }))
      .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
      .slice(0, limit);

    const blockNums = Array.from(
      new Set(sorted.map((l) => Number(l.blockNumber || 0)).filter((n) => n > 0))
    );
    const blockTs = new Map<number, number>();
    await Promise.all(
      blockNums.map(async (bn) => {
        try {
          const b = await provider.getBlock(bn);
          const ts = Number((b as any)?.timestamp || 0);
          if (ts > 0) blockTs.set(bn, ts);
        } catch {}
      })
    );

    const items: Item[] = [];
    for (const log of sorted) {
      try {
        const parsed = transferIface.parseLog(log as any);
        const from = String(parsed?.args?.from || "");
        const to = String(parsed?.args?.to || "");
        const value = BigInt(parsed?.args?.value || 0n);
        const valueFormatted = ethers.formatUnits(value, 6);
        items.push({
          txHash: String(log.transactionHash || ""),
          blockNumber: Number(log.blockNumber || 0),
          from,
          to,
          value: value.toString(),
          valueFormatted,
          timestamp: blockTs.get(Number(log.blockNumber || 0)) || undefined,
        });
      } catch {}
    }

    return withNoStore(
      successResponse(
        {
          chainId,
          usdcAddress,
          proxyAddress,
          windowBlocks,
          fromBlock,
          toBlock: latest,
          items,
        },
        "ok"
      )
    );
  } catch (e: any) {
    logApiError("GET /api/deposits/history", e);
    return withNoStore(ApiResponses.internalError("加载入金记录失败", String(e?.message || e)));
  }
}
