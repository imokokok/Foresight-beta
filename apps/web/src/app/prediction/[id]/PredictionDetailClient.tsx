"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { getFollowStatus, toggleFollowPrediction } from "@/lib/follows";
import { toast } from "@/lib/toast";
import { createOrderDomain } from "@/lib/orderVerification";
import { ORDER_TYPES } from "@/types/market";

// Components
import { MarketHeader } from "@/components/market/MarketHeader";
import { MarketChart } from "@/components/market/MarketChart";
import { TradingPanel } from "@/components/market/TradingPanel";
import { MarketInfo } from "@/components/market/MarketInfo";
import { Loader2 } from "lucide-react";

// ERC20/合约 ABI（最小化）
const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
];

const marketAbi = [
  "function mintCompleteSet(uint256 amount) external",
  "function depositCompleteSet(uint256 amount) external",
  "function outcomeToken() view returns (address)",
];

const erc1155Abi = [
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) external",
];

// 地址解析（基于 chainId）
function resolveAddresses(chainId: number): {
  foresight: string;
  usdc: string;
} {
  const defaultForesight = (process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS || "").trim();
  const defaultUsdc = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "").trim();

  const map: Record<number, { foresight?: string; usdc?: string }> = {
    137: {
      foresight: process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_POLYGON,
      usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_POLYGON,
    },
    80002: {
      foresight:
        process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_AMOY ||
        "0xBec1Fd7e69346aCBa7C15d6E380FcCA993Ea6b02",
      usdc:
        process.env.NEXT_PUBLIC_USDC_ADDRESS_AMOY || "0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf",
    },
    11155111: {
      foresight: process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_SEPOLIA,
      usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA,
    },
    31337: {
      foresight: process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_LOCALHOST,
      usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_LOCALHOST,
    },
    1337: {
      foresight: process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_LOCALHOST,
      usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_LOCALHOST,
    },
  };

  const fromMap = map[chainId] || {};
  const foresight = (fromMap.foresight || defaultForesight || "").trim();
  const usdc = (fromMap.usdc || defaultUsdc || "").trim();

  return { foresight, usdc };
}

// 将任意小数按指定 decimals 转为最小单位 BigInt
function parseUnitsByDecimals(value: number | string, decimals: number): bigint {
  const str = typeof value === "number" ? String(value) : value;
  try {
    return ethers.parseUnits(str, decimals);
  } catch {
    // 兜底处理，避免浮点误差
    const parts = str.split(".");
    if (parts.length === 1) {
      return BigInt(parts[0]) * BigInt(10) ** BigInt(decimals);
    }
    const [intPart, fracRaw] = parts;
    const frac = (fracRaw || "").slice(0, decimals).padEnd(decimals, "0");
    return BigInt(intPart || "0") * BigInt(10) ** BigInt(decimals) + BigInt(frac || "0");
  }
}

export interface PredictionDetail {
  id: number;
  title: string;
  description: string;
  category: string;
  deadline: string;
  minStake: number;
  criteria: string;
  referenceUrl: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  stats: {
    yesAmount: number;
    noAmount: number;
    totalAmount: number;
    participantCount: number;
    yesProbability: number;
    noProbability: number;
    betCount: number;
  };
  timeInfo: {
    createdAgo: string;
    deadlineIn: string;
    isExpired: boolean;
  };
  type?: string;
  outcome_count?: number;
  outcomes?: Array<any>;
}

export default function PredictionDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { account, provider: walletProvider, switchNetwork } = useWallet();

  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Market & Trading State
  const [market, setMarket] = useState<{
    market: string;
    chain_id: number;
    collateral_token?: string;
    tick_size?: number;
  } | null>(null);

  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeOutcome, setTradeOutcome] = useState<number>(0);
  const [priceInput, setPriceInput] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [orderMode, setOrderMode] = useState<"limit" | "best">("limit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  // Order Book Data
  const [depthBuy, setDepthBuy] = useState<Array<{ price: string; qty: string }>>([]);
  const [depthSell, setDepthSell] = useState<Array<{ price: string; qty: string }>>([]);
  const [bestBid, setBestBid] = useState<string>("");
  const [bestAsk, setBestAsk] = useState<string>("");
  const [openOrders, setOpenOrders] = useState<any[]>([]);

  // User State
  const [balance, setBalance] = useState<string>("0.00"); // Mock or fetch real balance
  const [mintInput, setMintInput] = useState<string>("");
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const refreshUserOrders = useCallback(async () => {
    if (!market || !account) return;
    try {
      const base = "/api";
      const mk = `${market.chain_id}:${params.id}`;
      const q = `contract=${market.market}&chainId=${
        market.chain_id
      }&marketKey=${encodeURIComponent(mk)}&maker=${account}&status=open`;
      const res = await fetch(`${base}/orderbook/orders?${q}`);
      const json = await res.json();
      if (json.success && json.data) {
        setOpenOrders(json.data);
      }
    } catch (e) {
      console.error("Refresh orders failed", e);
    }
  }, [market, account, params.id]);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/predictions/${params.id}?includeStats=1&includeOutcomes=1`);
        const data = await res.json();
        if (!cancelled) {
          if (data.success) {
            setPrediction(data.data);
            setError(null);
          } else {
            setError(data.message || "加载失败");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError("加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // Effects: Fetch Market Map
  useEffect(() => {
    const loadMarket = async () => {
      try {
        const resp = await fetch(`/api/markets/map?id=${params.id}`);
        const j = await resp.json();
        if (j?.success && j?.data) {
          setMarket(j.data);
        }
      } catch {}
    };
    loadMarket();
  }, [params.id]);

  // Effects: Fetch Follow Status
  useEffect(() => {
    if (!account || !params.id) return;
    getFollowStatus(Number(params.id), account).then((res) => {
      setFollowing(res.following);
      setFollowersCount(res.followersCount);
    });
  }, [params.id, account]);

  // Effects: Poll OrderBook
  useEffect(() => {
    if (!market) return;
    const fetchDepth = async () => {
      try {
        const base = "/api";
        const mk = `${market.chain_id}:${params.id}`;
        const qBuy = `contract=${market.market}&chainId=${
          market.chain_id
        }&marketKey=${encodeURIComponent(mk)}&outcome=${tradeOutcome}&side=true&levels=10`;
        const qSell = `contract=${market.market}&chainId=${
          market.chain_id
        }&marketKey=${encodeURIComponent(mk)}&outcome=${tradeOutcome}&side=false&levels=10`;

        const [r1, r2] = await Promise.all([
          fetch(`${base}/orderbook/depth?${qBuy}`),
          fetch(`${base}/orderbook/depth?${qSell}`),
        ]);
        const [j1, j2] = await Promise.all([r1.json(), r2.json()]);

        const buys = j1.data || [];
        const sells = j2.data || [];

        setDepthBuy(buys);
        setDepthSell(sells);
        setBestBid(buys.length > 0 ? buys[0].price : "");
        setBestAsk(sells.length > 0 ? sells[0].price : "");
      } catch {}
    };

    const timer = setInterval(fetchDepth, 2000);
    fetchDepth();
    return () => clearInterval(timer);
  }, [market, tradeOutcome, params.id]);

  // Effects: Poll User Orders
  useEffect(() => {
    if (!market || !account) return;
    refreshUserOrders();
    const timer = setInterval(refreshUserOrders, 5000);
    return () => clearInterval(timer);
  }, [market, account, params.id, refreshUserOrders]);

  // Actions
  const handleFollow = async () => {
    if (!account) return; // Trigger login
    setFollowLoading(true);
    try {
      const newStatus = await toggleFollowPrediction(following, Number(params.id), account);
      setFollowing(newStatus);
      setFollowersCount((p) => (newStatus ? p + 1 : p - 1));
    } finally {
      setFollowLoading(false);
    }
  };

  const cancelOrder = async (salt: string) => {
    if (!account || !market) return;
    try {
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();

      const domain = createOrderDomain(market.chain_id, market.market);
      const types = {
        CancelSaltRequest: [
          { name: "maker", type: "address" },
          { name: "salt", type: "uint256" },
        ],
      } as const;
      const value = {
        maker: account,
        salt: BigInt(salt),
      };
      const signature = await signer.signTypedData(domain as any, types as any, value as any);

      const base = "/api";
      const mk = `${market.chain_id}:${params.id}`;

      const res = await fetch(`${base}/orderbook/cancel-salt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: market.chain_id,
          verifyingContract: market.market,
          contract: market.market,
          marketKey: mk,
          salt,
          maker: account,
          signature,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setOrderMsg("订单已取消");
        // Optimistic update
        setOpenOrders((prev) => prev.filter((o) => o.maker_salt !== salt));
      } else {
        throw new Error(json.message || "取消失败");
      }
      toast.success("订单已取消", "您的订单已成功取消");
    } catch (e: any) {
      toast.error("取消订单失败", e.message || "请稍后重试");
    }
  };

  const handleMint = async (amountStr: string) => {
    try {
      if (!market || !account || !walletProvider) return;
      setOrderMsg("准备铸币...");

      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();

      // Check network
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== market.chain_id) {
        await switchNetwork(market.chain_id);
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Resolve decimals
      const addresses = resolveAddresses(market.chain_id);
      const collateralToken = market.collateral_token || addresses.usdc;
      console.log("[Mint] Market:", market.market, "Collateral:", collateralToken);

      const tokenContract = new ethers.Contract(collateralToken, erc20Abi, signer);
      const decimals = await tokenContract.decimals();
      const amountBN = parseUnitsByDecimals(amountStr, Number(decimals));
      console.log("[Mint] Amount:", amountStr, "Decimals:", decimals, "BN:", amountBN.toString());

      // Approve
      const allowance = await tokenContract.allowance(account, market.market);
      console.log("[Mint] Allowance:", allowance.toString());

      if (allowance < amountBN) {
        setOrderMsg("请授权 USDC...");
        const txApp = await tokenContract.approve(market.market, ethers.MaxUint256);
        await txApp.wait();
        console.log("[Mint] Approved");
      }

      // Mint
      setOrderMsg("正在铸币...");
      const marketContract = new ethers.Contract(market.market, marketAbi, signer);

      // Estimate gas to check for revert reasons early
      try {
        await marketContract.mintCompleteSet.estimateGas(amountBN);
      } catch (err: any) {
        console.error("[Mint] EstimateGas Failed:", err);
        throw new Error("铸币交易预估失败，请检查余额或权限: " + (err.reason || err.message));
      }

      const tx = await marketContract.mintCompleteSet(amountBN);
      console.log("[Mint] Tx sent:", tx.hash);
      await tx.wait();

      setOrderMsg("铸币成功！您现在可以出售代币了。");
      // Refresh balance if possible
    } catch (e: any) {
      console.error(e);
      setOrderMsg("铸币失败: " + (e.message || "未知错误"));
    }
  };

  const handleRedeem = async (amountStr: string) => {
    try {
      if (!market || !account || !walletProvider) return;
      setOrderMsg("准备赎回...");

      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();

      // Check network
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== market.chain_id) {
        await switchNetwork(market.chain_id);
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Resolve decimals (Collateral decimals used for amount)
      const addresses = resolveAddresses(market.chain_id);
      const collateralToken = market.collateral_token || addresses.usdc;
      const tokenContract = new ethers.Contract(collateralToken, erc20Abi, signer);
      const decimals = await tokenContract.decimals();
      const amountBN = parseUnitsByDecimals(amountStr, Number(decimals));

      // Check 1155 Approval
      const marketContract = new ethers.Contract(market.market, marketAbi, signer);
      const outcomeTokenAddress = await marketContract.outcomeToken();
      const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);

      const isApproved = await outcome1155.isApprovedForAll(account, market.market);
      if (!isApproved) {
        setOrderMsg("请授权预测代币...");
        const txApp = await outcome1155.setApprovalForAll(market.market, true);
        await txApp.wait();
      }

      // Redeem (Deposit Complete Set)
      setOrderMsg("正在赎回...");
      const tx = await marketContract.depositCompleteSet(amountBN);
      await tx.wait();

      setOrderMsg("赎回成功！USDC 已退回。");
    } catch (e: any) {
      console.error(e);
      setOrderMsg("赎回失败: " + (e.message || "未知错误"));
    }
  };

  const submitOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setOrderMsg(null);

    try {
      if (!market) throw new Error("市场信息未加载");
      if (!account) throw new Error("请先连接钱包");
      if (!walletProvider) throw new Error("钱包未初始化");

      const price = parseFloat(priceInput);
      const amount = parseFloat(amountInput);

      if (isNaN(price) || price <= 0 || price >= 1) throw new Error("价格无效 (0-1)");
      if (isNaN(amount) || amount <= 0) throw new Error("数量无效");

      // 1. Check Network
      const provider = new ethers.BrowserProvider(walletProvider);
      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId);

      if (currentChainId !== market.chain_id) {
        try {
          await switchNetwork(market.chain_id);
          // Wait a bit for network switch to settle
          await new Promise((r) => setTimeout(r, 1000));
        } catch (e: any) {
          throw new Error(`请切换到正确网络 (Chain ID: ${market.chain_id})`);
        }
      }

      // Refresh signer after switch
      const signer = await provider.getSigner();
      const addresses = resolveAddresses(market.chain_id);
      const collateralToken = market.collateral_token || addresses.usdc;

      // Resolve collateral decimals and convert price/amount to on-chain units
      const tokenContract = new ethers.Contract(collateralToken, erc20Abi, signer);
      const decimals = Number(await tokenContract.decimals());
      const priceBN = parseUnitsByDecimals(price.toString(), decimals);
      const amountInt = Math.floor(amount);
      if (amountInt <= 0) throw new Error("数量无效");
      const amountBN = BigInt(amountInt);

      // 2. Check Allowance (only for Buy orders or if using collateral)
      // For Buy: User pays USDC (or collateral)
      // For Sell: User pays Conditional Tokens (CT)
      // Simplified: Assume USDC for Buy, CT for Sell.
      if (tradeSide === "buy") {
        const cost = amountBN * priceBN;

        const allowance = await tokenContract.allowance(account, market.market);
        if (allowance < cost) {
          setOrderMsg("正在请求授权...");
          const tx = await tokenContract.approve(market.market, ethers.MaxUint256);
          await tx.wait();
          setOrderMsg("授权成功，正在下单...");
        }
      } else {
        // For Sell: User needs to approve the Market to spend their Outcome Tokens
        const marketContract = new ethers.Contract(market.market, marketAbi, signer);
        const outcomeTokenAddress = await marketContract.outcomeToken();
        const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);

        const isApproved = await outcome1155.isApprovedForAll(account, market.market);
        if (!isApproved) {
          setOrderMsg("请求预测代币授权...");
          const tx = await outcome1155.setApprovalForAll(market.market, true);
          await tx.wait();
          setOrderMsg("授权成功，正在下单...");
        }
      }

      // 3. Construct Order
      const salt = Math.floor(Math.random() * 1000000).toString();
      const expiry = Math.floor(Date.now() / 1000) + 3600 * 24; // 24h expiry

      const value = {
        maker: account,
        outcomeIndex: BigInt(tradeOutcome),
        price: priceBN,
        amount: amountBN,
        isBuy: tradeSide === "buy",
        salt: BigInt(salt),
        expiry: BigInt(expiry),
      };

      // 4. Sign Order
      const domain = createOrderDomain(market.chain_id, market.market);
      const signature = await signer.signTypedData(domain as any, ORDER_TYPES as any, value as any);

      // 5. Submit to Relayer
      const base = "/api";
      const mk = `${market.chain_id}:${params.id}`;
      const payload = {
        order: {
          maker: account,
          outcomeIndex: tradeOutcome,
          isBuy: tradeSide === "buy",
          price: priceBN.toString(),
          amount: amountBN.toString(),
          salt,
          expiry,
        },
        signature,
        chainId: market.chain_id,
        contract: market.market,
        verifyingContract: market.market,
        marketKey: mk,
        eventId: Number(params.id),
      };

      // Use /orders endpoint which handles POST
      const res = await fetch(`${base}/orderbook/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setOrderMsg("下单成功！");
        setAmountInput("");
        await refreshUserOrders();
      } else {
        throw new Error(json.message || "下单失败");
      }
    } catch (e: any) {
      console.error(e);
      let msg = e?.message || "交易失败";
      if (tradeSide === "sell") {
        const lower = msg.toLowerCase();
        const looksLikeNoBalance =
          lower.includes("insufficient") ||
          lower.includes("balance") ||
          lower.includes("no tokens") ||
          lower.includes("not enough");
        if (looksLikeNoBalance) {
          msg = "卖单失败：您的可卖预测代币数量不足，请先在下方完成铸币后再尝试挂卖单。";
        } else {
          msg =
            msg + "。如果尚未在下方完成铸币，可能是因为当前没有可卖的预测代币，请先铸币再试一次。";
        }
      }
      setOrderMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        {error || "未找到预测事件"}
      </div>
    );
  }

  const outcomes = prediction.outcomes || [];

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 font-sans pb-20 relative overflow-hidden">
      {/* Colorful Blobs Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] bg-pink-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-4000"></div>
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-emerald-100/40 rounded-full blur-[100px] mix-blend-multiply animate-blob animation-delay-6000"></div>
      </div>

      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] pointer-events-none opacity-30 z-0"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        {/* 1. Header Section */}
        <div className="mb-8">
          <MarketHeader
            prediction={prediction}
            followersCount={followersCount}
            following={following}
            onFollow={handleFollow}
            followLoading={followLoading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 2. Main Content (Left, 8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Chart */}
            <MarketChart
              market={market}
              prediction={prediction}
              tradeOutcome={tradeOutcome}
              setTradeOutcome={setTradeOutcome}
              outcomes={outcomes}
            />

            {/* Info Tabs & Content */}
            <MarketInfo prediction={prediction} />
          </div>

          {/* 3. Trading Panel (Right, 4 cols) */}
          <div className="lg:col-span-4">
            <div className="sticky top-24">
              <TradingPanel
                market={market}
                prediction={prediction}
                tradeSide={tradeSide}
                setTradeSide={setTradeSide}
                tradeOutcome={tradeOutcome}
                setTradeOutcome={setTradeOutcome}
                priceInput={priceInput}
                setPriceInput={setPriceInput}
                amountInput={amountInput}
                setAmountInput={setAmountInput}
                orderMode={orderMode}
                setOrderMode={setOrderMode}
                submitOrder={submitOrder}
                isSubmitting={isSubmitting}
                orderMsg={orderMsg}
                bestBid={bestBid}
                bestAsk={bestAsk}
                balance={balance}
                depthBuy={depthBuy}
                depthSell={depthSell}
                userOrders={openOrders}
                cancelOrder={cancelOrder}
                outcomes={outcomes}
              />
              <div className="mt-4 bg-white border border-purple-100 rounded-3xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                  <span>铸币 (USDC → 预测份额)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={mintInput}
                    onChange={(e) => setMintInput(e.target.value)}
                    placeholder="输入铸币数量 (USDC)"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-sm text-gray-900 focus:outline-none focus:border-purple-500 focus:bg-purple-50/30 focus:ring-2 focus:ring-purple-500/10"
                  />
                  <button
                    onClick={() => mintInput && handleMint(mintInput)}
                    disabled={!market || !account || !mintInput}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    铸币
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  先用 USDC 铸造完整预测份额，再在上方交易面板中挂卖单。
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
