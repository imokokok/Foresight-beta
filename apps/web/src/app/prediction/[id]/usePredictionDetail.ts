"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { useFollowPrediction } from "@/hooks/useFollowPrediction";
import { createOrderDomain } from "@/lib/orderVerification";
import { ORDER_TYPES } from "@/types/market";
import { useTranslations } from "@/lib/i18n";

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

export function usePredictionDetail() {
  const params = useParams();
  const { account, provider: walletProvider, switchNetwork } = useWallet();
  const tTrading = useTranslations("trading");

  const predictionIdRaw = (params as any).id;
  const predictionId = predictionIdRaw ? Number(predictionIdRaw) : undefined;

  const { prediction, loading, error } = usePredictionData(predictionIdRaw);
  const { market } = useMarketInfo(predictionIdRaw);

  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeOutcome, setTradeOutcome] = useState<number>(0);
  const [priceInput, setPriceInput] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [orderMode, setOrderMode] = useState<"limit" | "best">("best");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  const [balance] = useState<string>("0.00");
  const [mintInput, setMintInput] = useState<string>("");
  const { trades } = useTradesPolling(market);

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
      if (!market) throw new Error("市场信息未加载");
      if (!account) throw new Error("请先连接钱包");
      if (!walletProvider) throw new Error("钱包未初始化");

      const amountVal = parseFloat(amountInput);
      if (isNaN(amountVal) || amountVal <= 0) throw new Error("数量无效");
      const amountInt = Math.floor(amountVal);
      if (amountInt <= 0) throw new Error("数量无效");
      const amountBN = BigInt(amountInt);

      let priceBN: bigint | null = null;
      let priceFloat = 0;
      if (orderMode === "limit") {
        priceFloat = parseFloat(priceInput);
        if (isNaN(priceFloat) || priceFloat <= 0 || priceFloat >= 1) {
          throw new Error("价格无效 (0-1)");
        }
      }

      const provider = await createBrowserProvider(walletProvider);
      try {
        await ensureNetwork(provider, market.chain_id, switchNetwork);
      } catch (e: any) {
        throw new Error(`请切换到正确网络 (Chain ID: ${market.chain_id})`);
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
          amount: String(amountInt),
        });
        const quoteRes = await fetch(`${API_BASE}/orderbook/quote?${qs.toString()}`);
        const quoteJson = await safeJson(quoteRes);
        if (!quoteJson.success || !quoteJson.data) {
          throw new Error(quoteJson.message || "获取报价失败");
        }
        const q = quoteJson.data as any;
        const filledStr = String(q.filledAmount || "0");
        const totalStr = String(q.total || "0");
        const avgPriceStr = String(q.avgPrice || "0");
        const bestPriceStr = q.bestPrice != null ? String(q.bestPrice) : "0";
        const worstPriceStr = q.worstPrice != null ? String(q.worstPrice) : bestPriceStr;
        const slippageBpsStr = String(q.slippageBps || "0");

        const filledBN = BigInt(filledStr);
        if (filledBN === 0n) {
          throw new Error("当前订单簿流动性不足，无法成交");
        }
        const totalCostBN = BigInt(totalStr);
        const avgPriceBN = BigInt(avgPriceStr);
        const worstPriceBN = BigInt(worstPriceStr);
        const slippageBpsNum = Number(slippageBpsStr);

        const formatPriceNumber = (v: bigint) => {
          try {
            return Number(ethers.formatUnits(v, decimals));
          } catch {
            return Number(v);
          }
        };
        const formatAmountNumber = (v: bigint) => {
          try {
            return Number(v);
          } catch {
            return Number(v);
          }
        };

        const filledHuman = formatAmountNumber(filledBN);
        const avgPriceHuman = formatPriceNumber(avgPriceBN);
        const worstPriceHuman = formatPriceNumber(worstPriceBN);
        const totalHuman = formatPriceNumber(totalCostBN);

        const sideLabel = tradeSide === "buy" ? "买入" : "卖出";
        const slippagePercent = (slippageBpsNum || 0) / 100;
        const confirmMsg = `预计以均价 ${avgPriceHuman.toFixed(
          4
        )} USDC 成交 ${filledHuman} 份，最大价格 ${worstPriceHuman.toFixed(
          4
        )} USDC，总${tradeSide === "buy" ? "花费" : "收入"}约 ${totalHuman.toFixed(
          2
        )} USDC，预计滑点约 ${slippagePercent.toFixed(2)}%。是否确认${sideLabel}？`;
        const ok = typeof window !== "undefined" ? window.confirm(confirmMsg) : true;
        if (!ok) {
          setOrderMsg("已取消");
          return;
        }

        if (tradeSide === "buy") {
          const allowance = await tokenContract.allowance(account, market.market);
          if (allowance < totalCostBN) {
            setOrderMsg("正在请求授权...");
            const txApp = await tokenContract.approve(market.market, ethers.MaxUint256);
            await txApp.wait();
          }
        } else {
          const marketContract = new ethers.Contract(market.market, marketAbi, signer);
          const outcomeTokenAddress = await marketContract.outcomeToken();
          const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);
          const isApproved = await outcome1155.isApprovedForAll(account, market.market);
          if (!isApproved) {
            setOrderMsg("请求预测代币授权...");
            const tx1155 = await outcome1155.setApprovalForAll(market.market, true);
            await tx1155.wait();
          }
        }

        if (!RELAYER_BASE) {
          throw new Error("撮合服务未配置，无法完成市价成交");
        }

        const marketContract = new ethers.Contract(market.market, marketAbi, signer);
        let remainingToFill = filledBN;
        const levels = Array.isArray(q.levels) ? q.levels : [];

        for (const level of levels) {
          if (remainingToFill <= 0n) break;
          const levelPrice = String((level as any).price);
          const levelTakeQtyStr = String((level as any).takeQty || "0");
          let levelTakeQty: bigint;
          try {
            levelTakeQty = BigInt(levelTakeQtyStr);
          } catch {
            continue;
          }
          if (levelTakeQty <= 0n) continue;

          const makerSide = tradeSide === "buy" ? "sell" : "buy";
          const queueQs = new URLSearchParams({
            contract: market.market,
            chainId: String(market.chain_id),
            outcome: String(tradeOutcome),
            side: makerSide,
            price: levelPrice,
            limit: "200",
            offset: "0",
            marketKey,
          });
          const queueRes = await fetch(`${RELAYER_BASE}/orderbook/queue?${queueQs.toString()}`);
          const queueJson = await queueRes.json().catch(() => null);
          const queueData = queueJson && queueJson.success ? queueJson.data : null;
          if (!Array.isArray(queueData) || queueData.length === 0) continue;

          for (const row of queueData as any[]) {
            if (remainingToFill <= 0n) break;
            const remainingStr = String(row.remaining ?? "0");
            let makerRemaining: bigint;
            try {
              makerRemaining = BigInt(remainingStr);
            } catch {
              continue;
            }
            if (makerRemaining <= 0n) continue;
            const fillAmount = makerRemaining >= remainingToFill ? remainingToFill : makerRemaining;
            if (fillAmount <= 0n) continue;

            const orderId = row.id;
            const orderRes = await fetch(`${API_BASE}/orderbook/order?id=${orderId}`);
            const orderJson = await safeJson(orderRes);
            if (!orderJson.success || !orderJson.data) {
              continue;
            }
            const order = orderJson.data as any;

            const reqStruct = {
              maker: order.maker_address,
              outcomeIndex: Number(order.outcome_index),
              isBuy: Boolean(order.is_buy),
              price: BigInt(order.price),
              amount: BigInt(order.amount),
              expiry: order.expiry
                ? BigInt(Math.floor(new Date(order.expiry).getTime() / 1000))
                : 0n,
              salt: BigInt(order.maker_salt),
            };

            setOrderMsg("正在成交中...");
            const tx = await marketContract.fillOrderSigned(reqStruct, order.signature, fillAmount);
            const receipt = await tx.wait();

            try {
              await fetch(`${API_BASE}/orderbook/orders/fill`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chainId: market.chain_id,
                  verifyingContract: market.market,
                  contract: market.market,
                  marketKey,
                  maker: order.maker_address,
                  salt: order.maker_salt,
                  fillAmount: fillAmount.toString(),
                }),
              });
            } catch {}

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

            remainingToFill -= fillAmount;
          }
        }

        if (remainingToFill > 0n) {
          setOrderMsg("部分成交，剩余数量未能成交");
        } else {
          setOrderMsg("成交成功");
        }
        setAmountInput("");
        await refreshUserOrders();
        return;
      }

      priceBN = parseUnitsByDecimals(priceFloat.toString(), decimals);

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

      const mk = `${market.chain_id}:${predictionIdRaw}`;
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
        eventId: Number(predictionIdRaw),
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
