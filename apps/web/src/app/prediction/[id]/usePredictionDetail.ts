"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { useFollowPrediction } from "@/hooks/useFollowPrediction";
import { createOrderDomain } from "@/lib/orderVerification";
import { ORDER_TYPES } from "@/types/market";
import { useTranslations, formatTranslation } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { normalizeAddress } from "@/lib/cn";

import { erc1155Abi, erc20Abi, marketAbi } from "./_lib/abis";
import { API_BASE, RELAYER_BASE, buildMarketKey } from "./_lib/constants";
import { safeJson } from "./_lib/http";
import {
  createBrowserProvider,
  ensureNetwork,
  getCollateralTokenContract,
  parseUnitsByDecimals,
} from "./_lib/wallet";
import type { PredictionDetail } from "./_lib/types";
export type { PredictionDetail } from "./_lib/types";

import type { MarketInfo } from "./_lib/marketTypes";
import { usePredictionData } from "./_lib/hooks/usePredictionData";
import { useMarketInfo } from "./_lib/hooks/useMarketInfo";
import { useOrderbookDepthPolling } from "./_lib/hooks/useOrderbookDepthPolling";
import { useTradesPolling } from "./_lib/hooks/useTradesPolling";
import { useUserOpenOrders } from "./_lib/hooks/useUserOpenOrders";
import { cancelOrderAction } from "./_lib/actions/cancelOrder";
import { mintAction } from "./_lib/actions/mint";
import { redeemAction } from "./_lib/actions/redeem";

type MarketPlanPreview = {
  slippagePercent: number;
  avgPrice: number;
  worstPrice: number;
  totalCost: number;
  filledAmount: number;
  partialFill: boolean;
};

export function usePredictionDetail() {
  const params = useParams();
  const { account, provider: walletProvider, switchNetwork } = useWallet();
  const tTrading = useTranslations("trading");

  const predictionIdRaw = (params as any).id;
  const predictionId = predictionIdRaw ? Number(predictionIdRaw) : undefined;

  // 用于记录浏览历史，防止重复记录
  const viewRecordedRef = useRef<string | null>(null);

  const { prediction, loading, error } = usePredictionData(predictionIdRaw);
  const { market } = useMarketInfo(predictionIdRaw);

  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeOutcome, setTradeOutcome] = useState<number>(0);
  const [priceInput, setPriceInput] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [orderMode, setOrderMode] = useState<"limit" | "best">("best");
  const [tif, setTif] = useState<"GTC" | "IOC" | "FOK">("GTC");
  const [postOnly, setPostOnly] = useState(false);
  const [maxSlippage, setMaxSlippage] = useState<number>(1);
  const [editingOrderSalt, setEditingOrderSalt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  const [balance, setBalance] = useState<string>("0.00");
  const [usdcBalance, setUsdcBalance] = useState<string>("0.00");
  const [shareBalance, setShareBalance] = useState<string>("0");
  const [mintInput, setMintInput] = useState<string>("");
  const { trades } = useTradesPolling(market);
  const [marketPlanPreview, setMarketPlanPreview] = useState<MarketPlanPreview | null>(null);
  const [marketPlanLoading, setMarketPlanLoading] = useState(false);

  const { depthBuy, depthSell, bestBid, bestAsk } = useOrderbookDepthPolling({
    market,
    tradeOutcome,
    predictionIdRaw,
  });

  const { openOrders, setOpenOrders, refreshUserOrders } = useUserOpenOrders({
    market,
    account,
    predictionIdRaw,
  });

  const { following, followersCount, followLoading, followError, toggleFollow } =
    useFollowPrediction(predictionId, account || undefined);

  // 记录浏览历史（当用户登录且访问详情页时）
  useEffect(() => {
    if (!account || !predictionId) return;

    const accountNorm = normalizeAddress(account);

    // 避免同一用户对同一事件重复记录（在当前 mount 周期内）
    const recordKey = `${accountNorm}:${predictionId}`;
    if (viewRecordedRef.current === recordKey) return;
    viewRecordedRef.current = recordKey;

    // 异步记录浏览历史，不阻塞页面渲染
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: predictionId,
        walletAddress: accountNorm,
      }),
    }).catch((err) => {
      // 静默失败，不影响用户体验
      console.error("Failed to record view history:", err);
    });
  }, [account, predictionId]);

  // 读取真实 USDC 余额（用于交易面板展示）
  useEffect(() => {
    let cancelled = false;
    if (!market || !account || !walletProvider) return;

    const run = async () => {
      try {
        const provider = await createBrowserProvider(walletProvider);
        // 尽量确保读到的余额来自正确网络
        await ensureNetwork(provider, market.chain_id, switchNetwork);
        const signer = await provider.getSigner();
        const { tokenContract, decimals } = await getCollateralTokenContract(
          market,
          signer,
          erc20Abi
        );
        const bal = await tokenContract.balanceOf(account);
        const human = Number(ethers.formatUnits(bal, decimals));
        if (!cancelled) setUsdcBalance(Number.isFinite(human) ? human.toFixed(2) : "0.00");
      } catch {
        // ignore
      }
    };

    void run();
    const timer = setInterval(run, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [market, account, walletProvider, switchNetwork]);

  // 读取当前 outcome 的可卖份额（ERC1155 balance）
  useEffect(() => {
    let cancelled = false;
    if (!market || !account || !walletProvider) return;

    const run = async () => {
      try {
        const provider = await createBrowserProvider(walletProvider);
        await ensureNetwork(provider, market.chain_id, switchNetwork);
        const signer = await provider.getSigner();
        const marketContract = new ethers.Contract(market.market, marketAbi, signer);
        const outcomeTokenAddress = await marketContract.outcomeToken();
        const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);
        // OutcomeToken1155.computeTokenId(market, outcomeIndex) = (uint160(market) << 32) | outcomeIndex
        const tokenId = (BigInt(market.market) << 32n) | BigInt(tradeOutcome);
        const bal = await outcome1155.balanceOf(account, tokenId);
        if (!cancelled) setShareBalance(BigInt(bal).toString());
      } catch {
        // ignore
      }
    };

    void run();
    const timer = setInterval(run, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [market, account, walletProvider, switchNetwork, tradeOutcome]);

  // 根据买/卖切换展示的余额：买显示 USDC，卖显示可卖份额
  useEffect(() => {
    if (tradeSide === "sell") setBalance(shareBalance);
    else setBalance(`USDC ${usdcBalance}`);
  }, [tradeSide, usdcBalance, shareBalance]);

  useEffect(() => {
    if (!market || !predictionIdRaw) {
      setMarketPlanPreview(null);
      return;
    }
    if (orderMode !== "best") {
      setMarketPlanPreview(null);
      return;
    }
    const amountVal = parseFloat(amountInput);
    if (!amountInput || isNaN(amountVal) || amountVal <= 0) {
      setMarketPlanPreview(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      const run = async () => {
        try {
          setMarketPlanLoading(true);
          const amountBN = parseUnitsByDecimals(amountInput, 18);
          if (amountBN <= 0n) {
            if (!cancelled) setMarketPlanPreview(null);
            return;
          }
          const marketKey = buildMarketKey(market.chain_id, predictionIdRaw);
          const qs = new URLSearchParams({
            contract: market.market,
            chainId: String(market.chain_id),
            marketKey,
            outcome: String(tradeOutcome),
            side: tradeSide,
            amount: amountBN.toString(),
          });
          const planRes = await fetch(`${API_BASE}/orderbook/market-plan?${qs.toString()}`);
          const planJson = await safeJson(planRes);
          if (!planJson.success || !planJson.data) {
            if (!cancelled) setMarketPlanPreview(null);
            return;
          }
          const plan = planJson.data as any;
          const filledRaw = BigInt(String(plan.filledAmount || "0"));
          if (filledRaw === 0n) {
            if (!cancelled) setMarketPlanPreview(null);
            return;
          }
          const totalRaw = BigInt(String(plan.total || "0"));
          const avgPriceRaw = BigInt(String(plan.avgPrice || "0"));
          const worstPriceRaw = BigInt(String(plan.worstPrice || plan.bestPrice || "0"));
          const slippageBpsNum = Number(String(plan.slippageBps || "0"));
          const filledAmount = Number(filledRaw) / 1e18;
          const totalCost = Number(totalRaw) / 1e6;
          const avgPriceFromTotal =
            filledAmount > 0 && totalCost > 0 ? totalCost / filledAmount : 0;
          const avgPrice = avgPriceFromTotal > 0 ? avgPriceFromTotal : Number(avgPriceRaw) / 1e6;
          const worstPrice = Number(worstPriceRaw) / 1e6;
          const slippagePercent = (slippageBpsNum || 0) / 100;
          const partialFill = filledRaw < amountBN;
          if (!cancelled) {
            setMarketPlanPreview({
              slippagePercent,
              avgPrice,
              worstPrice,
              totalCost,
              filledAmount,
              partialFill,
            });
          }
        } catch {
          if (!cancelled) setMarketPlanPreview(null);
        } finally {
          if (!cancelled) setMarketPlanLoading(false);
        }
      };
      void run();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [market, predictionIdRaw, tradeOutcome, tradeSide, amountInput, orderMode]);

  const cancelOrder = async (salt: string) => {
    if (!account || !market || !walletProvider || !predictionIdRaw) return;
    await cancelOrderAction({
      salt,
      account,
      market: market as MarketInfo,
      walletProvider,
      predictionIdRaw,
      tTrading,
      setOrderMsg,
      setOpenOrders,
    });
  };

  const handleMint = async (amountStr: string) => {
    if (!market || !account || !walletProvider) return;
    await mintAction({
      amountStr,
      market: market as MarketInfo,
      account,
      walletProvider,
      switchNetwork,
      erc20Abi,
      marketAbi,
      setOrderMsg,
    });
  };

  const handleRedeem = async (amountStr: string) => {
    if (!market || !account || !walletProvider) return;
    await redeemAction({
      amountStr,
      market: market as MarketInfo,
      account,
      walletProvider,
      switchNetwork,
      erc20Abi,
      erc1155Abi,
      marketAbi,
      setOrderMsg,
    });
  };

  const submitOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setOrderMsg(null);

    try {
      if (!market) throw new Error(tTrading("orderFlow.marketNotLoaded"));
      if (!account) throw new Error(tTrading("orderFlow.walletRequired"));
      if (!walletProvider) throw new Error(tTrading("orderFlow.walletNotReady"));

      const amountVal = parseFloat(amountInput);
      if (isNaN(amountVal) || amountVal <= 0) throw new Error(tTrading("orderFlow.invalidAmount"));
      // shares are 1e18
      const amountBN = parseUnitsByDecimals(amountInput, 18);
      if (amountBN <= 0n) throw new Error(tTrading("orderFlow.invalidAmount"));
      // enforce max 6 decimals on shares (so on-chain USDC conversions are exact)
      if (amountBN % 1_000_000_000_000n !== 0n) {
        throw new Error(tTrading("orderFlow.invalidAmountPrecision"));
      }

      let priceBN: bigint | null = null;
      let priceFloat = 0;
      if (orderMode === "limit") {
        priceFloat = parseFloat(priceInput);
        if (isNaN(priceFloat) || priceFloat <= 0 || priceFloat >= 1) {
          throw new Error(tTrading("orderFlow.invalidPrice"));
        }
      }

      const provider = await createBrowserProvider(walletProvider);
      try {
        await ensureNetwork(provider, market.chain_id, switchNetwork);
      } catch (e: any) {
        throw new Error(
          formatTranslation(tTrading("orderFlow.switchNetwork"), {
            chainId: market.chain_id,
          })
        );
      }

      const signer = await provider.getSigner();
      const { tokenContract, decimals } = await getCollateralTokenContract(
        market,
        signer,
        erc20Abi
      );

      if (orderMode === "best") {
        const marketKey = buildMarketKey(market.chain_id, predictionIdRaw);
        const qs = new URLSearchParams({
          contract: market.market,
          chainId: String(market.chain_id),
          marketKey,
          outcome: String(tradeOutcome),
          side: tradeSide,
          amount: amountBN.toString(),
        });
        // 一次性拉取“成交计划”（包含将要吃掉的具体订单及每单 fillAmount）
        const planRes = await fetch(`${API_BASE}/orderbook/market-plan?${qs.toString()}`);
        const planJson = await safeJson(planRes);
        if (!planJson.success || !planJson.data) {
          throw new Error(planJson.message || tTrading("orderFlow.fetchPlanFailed"));
        }
        const plan = planJson.data as any;
        const filledBN = BigInt(String(plan.filledAmount || "0"));
        if (filledBN === 0n) throw new Error(tTrading("orderFlow.insufficientLiquidity"));

        const totalCostBN = BigInt(String(plan.total || "0"));
        const avgPriceBN = BigInt(String(plan.avgPrice || "0"));
        const bestPriceBN = BigInt(String(plan.bestPrice || "0"));
        const worstPriceBN = BigInt(String(plan.worstPrice || plan.bestPrice || "0"));
        const slippageBpsNum = Number(String(plan.slippageBps || "0"));
        const fills = Array.isArray(plan.fills) ? (plan.fills as any[]) : [];

        const formatPriceNumber = (v: bigint) => {
          try {
            return Number(ethers.formatUnits(v, decimals));
          } catch {
            return Number(v);
          }
        };
        const formatAmountNumber = (v: bigint) => {
          try {
            return Number(ethers.formatUnits(v, 18));
          } catch {
            return Number(v);
          }
        };

        const filledHuman = formatAmountNumber(filledBN);
        const avgPriceHuman = formatPriceNumber(avgPriceBN);
        const worstPriceHuman = formatPriceNumber(worstPriceBN);
        const totalHuman = formatPriceNumber(totalCostBN);

        const slippagePercent = (slippageBpsNum || 0) / 100;
        if (slippagePercent > maxSlippage) {
          throw new Error(tTrading("orderFlow.slippageTooHigh"));
        }

        const sideLabel = tradeSide === "buy" ? tTrading("buy") : tTrading("sell");
        const avgPriceStr = avgPriceHuman.toFixed(4);
        const worstPriceStr = worstPriceHuman.toFixed(4);
        const totalStr = totalHuman.toFixed(2);
        const filledStr = String(filledHuman);
        const totalAmountStr = String(formatAmountNumber(amountBN));
        const slippageStr = slippagePercent.toFixed(2);
        const confirmMsg = formatTranslation(tTrading("orderFlow.marketConfirm"), {
          side: sideLabel,
          filled: filledStr,
          total: totalAmountStr,
          avgPrice: avgPriceStr,
          worstPrice: worstPriceStr,
          totalCost: totalStr,
          slippage: slippageStr,
        });
        const ok = typeof window !== "undefined" ? window.confirm(confirmMsg) : true;
        if (!ok) {
          setOrderMsg(tTrading("orderFlow.orderFailedFallback"));
          return;
        }

        if (tradeSide === "buy") {
          const allowance = await tokenContract.allowance(account, market.market);
          if (allowance < totalCostBN) {
            setOrderMsg(tTrading("orderFlow.approving"));
            const txApp = await tokenContract.approve(market.market, ethers.MaxUint256);
            await txApp.wait();
          }
        } else {
          const marketContract = new ethers.Contract(market.market, marketAbi, signer);
          const outcomeTokenAddress = await marketContract.outcomeToken();
          const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);
          const isApproved = await outcome1155.isApprovedForAll(account, market.market);
          if (!isApproved) {
            setOrderMsg(tTrading("orderFlow.outcomeTokenApproving"));
            const tx1155 = await outcome1155.setApprovalForAll(market.market, true);
            await tx1155.wait();
          }
        }

        if (!RELAYER_BASE) {
          throw new Error(tTrading("orderFlow.relayerNotConfigured"));
        }

        const marketContract = new ethers.Contract(market.market, marketAbi, signer);
        const ordersArr: any[] = [];
        const sigArr: string[] = [];
        const fillArr: bigint[] = [];
        for (const f of fills) {
          const fillAmount = BigInt(String(f.fillAmount || "0"));
          if (fillAmount <= 0n) continue;
          const req = f.req || {};
          ordersArr.push({
            maker: String(req.maker),
            outcomeIndex: Number(req.outcomeIndex),
            isBuy: Boolean(req.isBuy),
            price: BigInt(String(req.price)),
            amount: BigInt(String(req.amount)),
            salt: BigInt(String(req.salt)),
            expiry: BigInt(String(req.expiry || "0")),
          });
          sigArr.push(String(f.signature));
          fillArr.push(fillAmount);
        }

        if (ordersArr.length === 0) throw new Error(tTrading("orderFlow.noFillableOrders"));
        setOrderMsg(
          formatTranslation(tTrading("orderFlow.matchingInProgress"), {
            count: ordersArr.length,
          })
        );
        const tx = await marketContract.batchFill(ordersArr, sigArr, fillArr);
        const receipt = await tx.wait();

        // 仍保留回灌兜底（relayer 后续会自动索引，这里留一层兼容）
        try {
          await fetch(`${API_BASE}/orderbook/report-trade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chainId: market.chain_id,
              txHash: receipt.hash,
            }),
          });
        } catch {}

        if (filledBN < amountBN) setOrderMsg(tTrading("orderFlow.partialFilled"));
        else setOrderMsg(tTrading("orderFlow.filled"));
        setAmountInput("");
        await refreshUserOrders();
        toast.success(tTrading("toast.orderSuccessTitle"), tTrading("toast.orderSuccessDesc"));
        return;
      }

      if (orderMode === "limit" && editingOrderSalt) {
        await cancelOrder(editingOrderSalt);
        setEditingOrderSalt(null);
      }

      priceBN = parseUnitsByDecimals(priceFloat.toString(), decimals);

      if (tradeSide === "buy") {
        // cost6 = amount18 * price6Per1e18 / 1e18
        const cost = (amountBN * priceBN) / 1_000_000_000_000_000_000n;

        const allowance = await tokenContract.allowance(account, market.market);
        if (allowance < cost) {
          setOrderMsg(tTrading("orderFlow.approving"));
          const tx = await tokenContract.approve(market.market, ethers.MaxUint256);
          await tx.wait();
          setOrderMsg(tTrading("orderFlow.approveThenPlace"));
        }
      } else {
        const marketContract = new ethers.Contract(market.market, marketAbi, signer);
        const outcomeTokenAddress = await marketContract.outcomeToken();
        const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);

        const isApproved = await outcome1155.isApprovedForAll(account, market.market);
        if (!isApproved) {
          setOrderMsg(tTrading("orderFlow.outcomeTokenApproving"));
          const tx = await outcome1155.setApprovalForAll(market.market, true);
          await tx.wait();
          setOrderMsg(tTrading("orderFlow.approveThenPlace"));
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

      const mk = `${market.chain_id}:${predictionIdRaw}`;
      const tifForOrder = tif === "GTC" ? undefined : tif;
      const payload = {
        order: {
          maker: account,
          outcomeIndex: tradeOutcome,
          isBuy: tradeSide === "buy",
          price: priceBN.toString(),
          amount: amountBN.toString(),
          salt,
          expiry,
          ...(tifForOrder ? { tif: tifForOrder } : {}),
          ...(postOnly ? { postOnly: true } : {}),
        },
        signature,
        chainId: market.chain_id,
        contract: market.market,
        verifyingContract: market.market,
        marketKey: mk,
        eventId: Number(predictionIdRaw),
      };

      if (RELAYER_BASE) {
        try {
          const resV2 = await fetch(`${RELAYER_BASE}/v2/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              marketKey: mk,
              chainId: market.chain_id,
              verifyingContract: market.market,
              signature,
              order: payload.order,
            }),
            signal: AbortSignal.timeout(5000),
          });

          const jsonV2 = await safeJson(resV2 as any);
          if ((jsonV2 as any).success) {
            const data = (jsonV2 as any).data || {};
            const filledStr = String(data.filledAmount ?? "0");
            let filled = 0n;
            try {
              filled = BigInt(filledStr);
            } catch {
              filled = 0n;
            }
            const status = String((data as any).status || "");

            if (status === "canceled" && filled === 0n) {
              setOrderMsg(tTrading("orderFlow.canceled"));
            } else if (filled === 0n) {
              setOrderMsg(tTrading("orderFlow.orderSuccess"));
            } else if (filled < amountBN) {
              setOrderMsg(tTrading("orderFlow.partialFilled"));
            } else {
              setOrderMsg(tTrading("orderFlow.filled"));
            }

            setAmountInput("");
            await refreshUserOrders();
            toast.success(tTrading("toast.orderSuccessTitle"), tTrading("toast.orderSuccessDesc"));
            return;
          }
        } catch (err) {
          console.error("[orderFlow] v2 order submit failed, falling back to v1:", err);
        }
      }

      const res = await fetch(`${API_BASE}/orderbook/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await safeJson(res);
      if (json.success) {
        setOrderMsg(tTrading("orderFlow.orderSuccess"));
        setAmountInput("");
        await refreshUserOrders();
        toast.success(tTrading("toast.orderSuccessTitle"), tTrading("toast.orderSuccessDesc"));
      } else {
        throw new Error(json.message || tTrading("orderFlow.orderFailedFallback"));
      }
    } catch (e: any) {
      let msg = e?.message || tTrading("orderFlow.tradeFailed");
      if (tradeSide === "sell") {
        const lower = msg.toLowerCase();
        const looksLikeNoBalance =
          lower.includes("insufficient") ||
          lower.includes("balance") ||
          lower.includes("no tokens") ||
          lower.includes("not enough");
        if (looksLikeNoBalance) {
          msg = tTrading("orderFlow.sellNoBalance");
        } else {
          msg = `${msg} ${tTrading("orderFlow.sellMaybeNoMint")}`;
        }
      }
      setOrderMsg(msg);
      toast.error(tTrading("toast.orderFailedTitle"), msg || tTrading("toast.orderFailedDesc"));
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
    tif,
    setTif,
    postOnly,
    setPostOnly,
    maxSlippage,
    setMaxSlippage,
    editingOrderSalt,
    setEditingOrderSalt,
    isSubmitting,
    orderMsg,
    depthBuy,
    depthSell,
    bestBid,
    bestAsk,
    openOrders,
    trades,
    balance,
    shareBalance,
    mintInput,
    setMintInput,
    handleMint,
    handleRedeem,
    submitOrder,
    cancelOrder,
    marketPlanPreview,
    marketPlanLoading,
  };
}
