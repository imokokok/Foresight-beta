"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { useFollowPrediction } from "@/hooks/useFollowPrediction";
import { toast } from "@/lib/toast";
import { createOrderDomain } from "@/lib/orderVerification";
import { ORDER_TYPES } from "@/types/market";
import { useTranslations } from "@/lib/i18n";

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

const API_BASE = "/api";

function buildMarketKey(chainId: number, eventId: string | number) {
  return `${chainId}:${eventId}`;
}

async function fetchOrderbookDepthApi(
  contract: string,
  chainId: number,
  marketKey: string,
  outcome: number
) {
  const qBuy = `contract=${contract}&chainId=${chainId}&marketKey=${encodeURIComponent(
    marketKey
  )}&outcome=${outcome}&side=true&levels=10`;
  const qSell = `contract=${contract}&chainId=${chainId}&marketKey=${encodeURIComponent(
    marketKey
  )}&outcome=${outcome}&side=false&levels=10`;

  const [r1, r2] = await Promise.all([
    fetch(`${API_BASE}/orderbook/depth?${qBuy}`),
    fetch(`${API_BASE}/orderbook/depth?${qSell}`),
  ]);
  const [j1, j2] = await Promise.all([safeJson(r1), safeJson(r2)]);

  return {
    buys: j1.data || [],
    sells: j2.data || [],
  };
}

async function fetchUserOpenOrdersApi(
  contract: string,
  chainId: number,
  marketKey: string,
  maker: string
) {
  const q = `contract=${contract}&chainId=${chainId}&marketKey=${encodeURIComponent(
    marketKey
  )}&maker=${maker}&status=open`;
  const res = await fetch(`${API_BASE}/orderbook/orders?${q}`);
  const json = await safeJson(res);
  if (json.success && json.data) {
    return json.data;
  }
  return [];
}

async function fetchTradesApi(contract: string, chainId: number) {
  const q = `contract=${contract}&chainId=${chainId}&limit=50`;
  const res = await fetch(`${API_BASE}/orderbook/trades?${q}`);
  const json = await safeJson(res);
  if (json.success && json.data) {
    return json.data;
  }
  return [];
}

async function safeJson<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    if (text && text.trim().startsWith("<!DOCTYPE html")) {
      throw new Error("Server returned an HTML error page");
    }
    throw new Error("Unexpected response format");
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("Invalid JSON response");
  }
}

async function createBrowserProvider(walletProvider: any) {
  return new ethers.BrowserProvider(walletProvider);
}

async function ensureNetwork(
  provider: ethers.BrowserProvider,
  targetChainId: number,
  switchNetwork: (chainId: number) => Promise<void>
) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== targetChainId) {
    await switchNetwork(targetChainId);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

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

async function getCollateralTokenContract(
  market: { market: string; chain_id: number; collateral_token?: string },
  signer: ethers.Signer
) {
  const addresses = resolveAddresses(market.chain_id);
  const collateralToken = market.collateral_token || addresses.usdc;
  const tokenContract = new ethers.Contract(collateralToken, erc20Abi, signer);
  const decimals = await tokenContract.decimals();
  return { tokenContract, decimals: Number(decimals) };
}

function parseUnitsByDecimals(value: number | string, decimals: number): bigint {
  const str = typeof value === "number" ? String(value) : value;
  try {
    return ethers.parseUnits(str, decimals);
  } catch {
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

export function usePredictionDetail() {
  const params = useParams();
  const { account, provider: walletProvider, switchNetwork } = useWallet();
  const tTrading = useTranslations("trading");

  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const [depthBuy, setDepthBuy] = useState<Array<{ price: string; qty: string }>>([]);
  const [depthSell, setDepthSell] = useState<Array<{ price: string; qty: string }>>([]);
  const [bestBid, setBestBid] = useState<string>("");
  const [bestAsk, setBestAsk] = useState<string>("");
  const [openOrders, setOpenOrders] = useState<any[]>([]);

  const [balance] = useState<string>("0.00");
  const [mintInput, setMintInput] = useState<string>("");
  const [trades, setTrades] = useState<any[]>([]);

  const predictionId = (params as any).id ? Number((params as any).id) : undefined;

  const { following, followersCount, followLoading, followError, toggleFollow } =
    useFollowPrediction(predictionId, account || undefined);

  const refreshUserOrders = useCallback(async () => {
    if (!market || !account) return;
    try {
      const eventId = (params as any).id;
      const marketKey = buildMarketKey(market.chain_id, eventId);
      const orders = await fetchUserOpenOrdersApi(
        market.market,
        market.chain_id,
        marketKey,
        account
      );
      setOpenOrders(orders);
    } catch (e) {
      console.error("Refresh orders failed", e);
    }
  }, [market, account, params]);

  useEffect(() => {
    if (!(params as any).id) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/predictions/${(params as any).id}?includeStats=1&includeOutcomes=1`
        );
        const data = await safeJson(res);
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
  }, [params]);

  useEffect(() => {
    const loadMarket = async () => {
      try {
        const resp = await fetch(`${API_BASE}/markets/map?id=${(params as any).id}`);
        const j = await safeJson(resp);
        if (j?.success && j?.data) {
          setMarket(j.data);
        }
      } catch {}
    };
    loadMarket();
  }, [params]);

  useEffect(() => {
    if (!market) return;
    const fetchDepth = async () => {
      try {
        const eventId = (params as any).id;
        const marketKey = buildMarketKey(market.chain_id, eventId);
        const { buys, sells } = await fetchOrderbookDepthApi(
          market.market,
          market.chain_id,
          marketKey,
          tradeOutcome
        );

        setDepthBuy(buys);
        setDepthSell(sells);
        setBestBid(buys.length > 0 ? buys[0].price : "");
        setBestAsk(sells.length > 0 ? sells[0].price : "");
      } catch {}
    };

    const timer = setInterval(fetchDepth, 2000);
    fetchDepth();
    return () => clearInterval(timer);
  }, [market, tradeOutcome, params]);

  useEffect(() => {
    if (!market || !account) return;
    refreshUserOrders();
    const timer = setInterval(refreshUserOrders, 5000);
    return () => clearInterval(timer);
  }, [market, account, refreshUserOrders]);

  useEffect(() => {
    if (!market) return;
    const fetchTrades = async () => {
      try {
        const items = await fetchTradesApi(market.market, market.chain_id);
        setTrades(items);
      } catch (e) {
        console.error("Fetch trades failed", e);
      }
    };

    fetchTrades();
    const timer = setInterval(fetchTrades, 5000);
    return () => clearInterval(timer);
  }, [market]);

  const cancelOrder = async (salt: string) => {
    if (!account || !market) return;
    try {
      const provider = await createBrowserProvider(walletProvider);
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

      const mk = `${market.chain_id}:${(params as any).id}`;

      const res = await fetch(`${API_BASE}/orderbook/cancel-salt`, {
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

      const json = await safeJson(res);
      if (json.success) {
        setOrderMsg("订单已取消");
        setOpenOrders((prev) => prev.filter((o) => o.maker_salt !== salt));
      } else {
        throw new Error(json.message || "取消失败");
      }
      toast.success(
        tTrading("toast.cancelOrderSuccessTitle"),
        tTrading("toast.cancelOrderSuccessDesc")
      );
    } catch (error: any) {
      const description = error?.message || tTrading("toast.retryLater");
      toast.error(tTrading("toast.cancelOrderFailedTitle"), description);
    }
  };

  const handleMint = async (amountStr: string) => {
    try {
      if (!market || !account || !walletProvider) return;
      setOrderMsg("准备铸币...");

      const provider = await createBrowserProvider(walletProvider);
      await ensureNetwork(provider, market.chain_id, switchNetwork);
      const signer = await provider.getSigner();

      const { tokenContract, decimals } = await getCollateralTokenContract(market, signer);
      const amountBN = parseUnitsByDecimals(amountStr, decimals);

      const allowance = await tokenContract.allowance(account, market.market);

      if (allowance < amountBN) {
        setOrderMsg("请授权 USDC...");
        const txApp = await tokenContract.approve(market.market, ethers.MaxUint256);
        await txApp.wait();
      }

      setOrderMsg("正在铸币...");
      const marketContract = new ethers.Contract(market.market, marketAbi, signer);

      try {
        await marketContract.mintCompleteSet.estimateGas(amountBN);
      } catch (err: any) {
        throw new Error("铸币交易预估失败，请检查余额或权限: " + (err.reason || err.message));
      }

      const tx = await marketContract.mintCompleteSet(amountBN);
      await tx.wait();

      setOrderMsg("铸币成功！您现在可以出售代币了。");
    } catch (e: any) {
      setOrderMsg("铸币失败: " + (e.message || "未知错误"));
    }
  };

  const handleRedeem = async (amountStr: string) => {
    try {
      if (!market || !account || !walletProvider) return;
      setOrderMsg("准备赎回...");

      const provider = await createBrowserProvider(walletProvider);
      await ensureNetwork(provider, market.chain_id, switchNetwork);
      const signer = await provider.getSigner();

      const { decimals } = await getCollateralTokenContract(market, signer);
      const amountBN = parseUnitsByDecimals(amountStr, decimals);

      const marketContract = new ethers.Contract(market.market, marketAbi, signer);
      const outcomeTokenAddress = await marketContract.outcomeToken();
      const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);

      const isApproved = await outcome1155.isApprovedForAll(account, market.market);
      if (!isApproved) {
        setOrderMsg("请授权预测代币...");
        const txApp = await outcome1155.setApprovalForAll(market.market, true);
        await txApp.wait();
      }

      setOrderMsg("正在赎回...");
      const tx = await marketContract.depositCompleteSet(amountBN);
      await tx.wait();

      setOrderMsg("赎回成功！USDC 已退回。");
    } catch (e: any) {
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

      const provider = await createBrowserProvider(walletProvider);
      try {
        await ensureNetwork(provider, market.chain_id, switchNetwork);
      } catch (e: any) {
        throw new Error(`请切换到正确网络 (Chain ID: ${market.chain_id})`);
      }

      const signer = await provider.getSigner();
      const { tokenContract, decimals } = await getCollateralTokenContract(market, signer);
      const priceBN = parseUnitsByDecimals(price.toString(), decimals);
      const amountInt = Math.floor(amount);
      if (amountInt <= 0) throw new Error("数量无效");
      const amountBN = BigInt(amountInt);

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

      const salt = Math.floor(Math.random() * 1000000).toString();
      const expiry = Math.floor(Date.now() / 1000) + 3600 * 24;

      const value = {
        maker: account,
        outcomeIndex: BigInt(tradeOutcome),
        price: priceBN,
        amount: amountBN,
        isBuy: tradeSide === "buy",
        salt: BigInt(salt),
        expiry: BigInt(expiry),
      };

      const domain = createOrderDomain(market.chain_id, market.market);
      const signature = await signer.signTypedData(domain as any, ORDER_TYPES as any, value as any);

      const mk = `${market.chain_id}:${(params as any).id}`;
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
        eventId: Number((params as any).id),
      };

      const res = await fetch(`${API_BASE}/orderbook/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await safeJson(res);
      if (json.success) {
        setOrderMsg("下单成功！");
        setAmountInput("");
        await refreshUserOrders();
      } else {
        throw new Error(json.message || "下单失败");
      }
    } catch (e: any) {
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

  return {
    loading,
    error,
    prediction,
    market,
    account,
    followersCount,
    following,
    toggleFollow,
    followLoading,
    followError,
    tradeSide,
    setTradeSide,
    tradeOutcome,
    setTradeOutcome,
    priceInput,
    setPriceInput,
    amountInput,
    setAmountInput,
    orderMode,
    setOrderMode,
    isSubmitting,
    orderMsg,
    depthBuy,
    depthSell,
    bestBid,
    bestAsk,
    openOrders,
    trades,
    balance,
    mintInput,
    setMintInput,
    handleMint,
    handleRedeem,
    submitOrder,
    cancelOrder,
  };
}
