"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { useFollowPrediction } from "@/hooks/useFollowPrediction";
import { useTranslations, formatTranslation } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { logClientErrorToApi } from "@/lib/errorReporting";
import { normalizeAddress } from "@/lib/address";

import { erc1155Abi, erc20Abi, marketAbi } from "./_lib/abis";
import {
  buildOrdersFromFills,
  buildMarketConfirmMessage,
  fetchMarketPlanPayload,
} from "./_lib/orderbookPlan";
import {
  submitLimitOrder,
  submitMarketOrderDirect,
  submitMarketOrderWithAa,
  submitMarketOrderWithAaReadonly,
  submitMarketOrderWithProxy,
} from "./_lib/orderFlow";
import {
  createBrowserProvider,
  ensureNetwork,
  getCollateralTokenContract,
  parseUnitsByDecimals,
  resolveAddresses,
} from "./_lib/wallet";
export type { PredictionDetail } from "./_lib/types";

import type { MarketInfo } from "./_lib/marketTypes";
import { usePredictionData } from "./_lib/hooks/usePredictionData";
import { useMarketInfo } from "./_lib/hooks/useMarketInfo";
import { useOrderbookDepthPolling } from "./_lib/hooks/useOrderbookDepthPolling";
import { useTradesPolling } from "./_lib/hooks/useTradesPolling";
import { useUserOpenOrders } from "./_lib/hooks/useUserOpenOrders";
import { useProxyAddress } from "./_lib/hooks/useProxyAddress";
import { useTokenBalancePolling } from "./_lib/hooks/useTokenBalancePolling";
import { useOutcomeBalancePolling } from "./_lib/hooks/useOutcomeBalancePolling";
import { useTradingState } from "./_lib/hooks/useTradingState";
import { useOrderErrorHandling } from "./_lib/hooks/useOrderErrorHandling";
import { useMarketConfirm } from "./_lib/hooks/useMarketConfirm";
import { useMarketPlanPreview } from "./_lib/hooks/useMarketPlanPreview";
import { cancelOrderAction } from "./_lib/actions/cancelOrder";
import { mintAction } from "./_lib/actions/mint";
import { redeemAction } from "./_lib/actions/redeem";
import { isAaEnabled } from "./_lib/aaUtils";
import { getFallbackRpcUrl } from "@/lib/walletProviderUtils";

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

  // 使用自定义 hooks
  const tradingState = useTradingState();
  const {
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
    setIsSubmitting,
    orderMsg,
    setOrderMsg,
  } = tradingState;

  const { createUserError, handleOrderError } = useOrderErrorHandling(tradeSide);
  const marketConfirm = useMarketConfirm();
  const { marketPlanPreview, marketPlanLoading } = useMarketPlanPreview({
    market,
    predictionIdRaw,
    tradeOutcome,
    tradeSide,
    amountInput,
    orderMode,
  });

  const [balance, setBalance] = useState<string>("0.00");
  const [mintInput, setMintInput] = useState<string>("");
  const { trades } = useTradesPolling(market, predictionIdRaw, tradeOutcome);

  // Proxy Wallet State
  const [useProxy, setUseProxy] = useState(false);
  const proxyAddress = useProxyAddress(account);
  const usdcBalance = useTokenBalancePolling({
    market,
    address: account || undefined,
    walletProvider,
    switchNetwork,
  });
  const shareBalance = useOutcomeBalancePolling({
    market,
    address: account || undefined,
    walletProvider,
    switchNetwork,
    tradeOutcome,
  });
  const proxyBalance = useTokenBalancePolling({
    market,
    address: proxyAddress,
    walletProvider,
    switchNetwork,
  });
  const proxyShareBalance = useOutcomeBalancePolling({
    market,
    address: proxyAddress,
    walletProvider,
    switchNetwork,
    tradeOutcome,
  });

  const cancelMarketConfirm = useCallback(() => {
    marketConfirm.cancelMarketConfirm();
    setOrderMsg(tTrading("orderFlow.orderFailedFallback"));
  }, [tTrading, marketConfirm]);

  const { depthBuy, depthSell, bestBid, bestAsk } = useOrderbookDepthPolling({
    market,
    tradeOutcome,
    predictionIdRaw,
  });

  const { openOrders, setOpenOrders, refreshUserOrders } = useUserOpenOrders({
    market,
    account,
    predictionIdRaw,
    proxyAddress,
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

  // 根据买/卖切换展示的余额：买显示 USDC (or Proxy USDC)，卖显示可卖份额
  useEffect(() => {
    if (tradeSide === "sell") {
      setBalance(useProxy ? proxyShareBalance : shareBalance);
    } else {
      if (useProxy) {
        setBalance(`USDC ${proxyBalance} (Proxy)`);
      } else {
        setBalance(`USDC ${usdcBalance}`);
      }
    }
  }, [tradeSide, usdcBalance, shareBalance, useProxy, proxyBalance, proxyShareBalance]);

  const cancelOrder = async (salt: string) => {
    if (!account || !market || !walletProvider || !predictionIdRaw) return;

    const order = openOrders.find((o: any) => String(o.salt) === String(salt));
    const maker = order?.maker || account;

    await cancelOrderAction({
      salt,
      account,
      maker,
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
      useProxy,
      proxyAddress,
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
      useProxy,
      proxyAddress,
    });
  };

  const submitOrder = async (options?: { useProxy?: boolean; proxyAddress?: string }) => {
    const useProxyVal = options?.useProxy ?? useProxy;
    const proxyAddressVal = options?.proxyAddress ?? proxyAddress;

    if (isSubmitting) return;
    setIsSubmitting(true);
    setOrderMsg(null);

    try {
      if (!market) throw createUserError(tTrading("orderFlow.marketNotLoaded"));
      if (!account) throw createUserError(tTrading("orderFlow.walletRequired"));

      const amountVal = parseFloat(amountInput);
      if (isNaN(amountVal) || amountVal <= 0) {
        throw createUserError(tTrading("orderFlow.invalidAmount"));
      }
      // shares are 1e18
      const amountBN = parseUnitsByDecimals(amountInput, 18);
      if (amountBN <= 0n) throw createUserError(tTrading("orderFlow.invalidAmount"));
      // enforce max 6 decimals on shares (so on-chain USDC conversions are exact)
      if (amountBN % 1_000_000_000_000n !== 0n) {
        throw createUserError(tTrading("orderFlow.invalidAmountPrecision"));
      }

      let priceBN: bigint | null = null;
      let priceFloat = 0;
      if (orderMode === "limit") {
        priceFloat = parseFloat(priceInput);
        if (isNaN(priceFloat) || priceFloat <= 0 || priceFloat >= 1) {
          throw createUserError(tTrading("orderFlow.invalidPrice"));
        }
      }

      if (orderMode === "best" && isAaEnabled() && !walletProvider) {
        const rpcUrl = getFallbackRpcUrl(market.chain_id);
        if (!rpcUrl) throw createUserError(tTrading("orderFlow.walletNotReady"));

        const readProvider = new ethers.JsonRpcProvider(rpcUrl);

        const collateralToken = (() => {
          const base = resolveAddresses(market.chain_id);
          return market.collateral_token || base.usdc;
        })();

        const decimals = await (async () => {
          try {
            const token = new ethers.Contract(collateralToken, erc20Abi, readProvider);
            const d = await token.decimals();
            const n = Number(d);
            return Number.isFinite(n) && n > 0 ? n : 6;
          } catch {
            return 6;
          }
        })();

        const payload = await fetchMarketPlanPayload({
          market,
          predictionIdRaw,
          tradeOutcome,
          tradeSide,
          amountBN,
        });
        if (!payload) {
          throw new Error(tTrading("orderFlow.fetchPlanFailed"));
        }
        if (payload.filledBN === 0n) {
          throw createUserError(tTrading("orderFlow.insufficientLiquidity"));
        }

        const { message: confirmMsg, isSlippageTooHigh } = buildMarketConfirmMessage({
          payload,
          amountBN,
          decimals,
          tradeSide,
          maxSlippage,
          tTrading,
          formatTranslation,
        });
        if (isSlippageTooHigh) {
          throw createUserError(tTrading("orderFlow.slippageTooHigh"));
        }

        marketConfirm.setMarketConfirm({
          message: confirmMsg,
          onConfirm: async () => {
            setIsSubmitting(true);
            setOrderMsg(null);
            try {
              const { ordersArr, sigArr, fillArr } = buildOrdersFromFills(payload.fills);

              if (ordersArr.length === 0) {
                throw createUserError(tTrading("orderFlow.noFillableOrders"));
              }

              const matchingMessage = formatTranslation(tTrading("orderFlow.matchingInProgress"), {
                count: ordersArr.length,
              });

              await submitMarketOrderWithAaReadonly({
                market,
                tradeSide,
                amountBN,
                filledBN: payload.filledBN,
                ordersArr,
                sigArr,
                fillArr,
                collateralToken,
                readProvider,
                matchingMessage,
                tTrading,
                setOrderMsg,
                setAmountInput,
                refreshUserOrders,
                toast,
              });
            } catch (e: any) {
              handleOrderError(e, setOrderMsg);
            } finally {
              setIsSubmitting(false);
            }
          },
        });

        setIsSubmitting(false);
        return;
      }

      if (!walletProvider) throw createUserError(tTrading("orderFlow.walletNotReady"));

      const provider = await createBrowserProvider(walletProvider);
      try {
        await ensureNetwork(provider, market.chain_id, switchNetwork);
      } catch (e: any) {
        throw createUserError(
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
        const payload = await fetchMarketPlanPayload({
          market,
          predictionIdRaw,
          tradeOutcome,
          tradeSide,
          amountBN,
        });
        if (!payload) {
          throw new Error(tTrading("orderFlow.fetchPlanFailed"));
        }
        if (payload.filledBN === 0n) {
          throw createUserError(tTrading("orderFlow.insufficientLiquidity"));
        }

        const { message: confirmMsg, isSlippageTooHigh } = buildMarketConfirmMessage({
          payload,
          amountBN,
          decimals,
          tradeSide,
          maxSlippage,
          tTrading,
          formatTranslation,
        });
        if (isSlippageTooHigh) {
          throw createUserError(tTrading("orderFlow.slippageTooHigh"));
        }
        marketConfirm.setMarketConfirm({
          message: confirmMsg,
          onConfirm: async () => {
            setIsSubmitting(true);
            setOrderMsg(null);
            try {
              const { ordersArr, sigArr, fillArr } = buildOrdersFromFills(payload.fills);

              if (ordersArr.length === 0) {
                throw createUserError(tTrading("orderFlow.noFillableOrders"));
              }

              const matchingMessage = formatTranslation(tTrading("orderFlow.matchingInProgress"), {
                count: ordersArr.length,
              });

              if (useProxyVal && proxyAddressVal) {
                await submitMarketOrderWithProxy({
                  market,
                  tradeSide,
                  amountBN,
                  totalCostBN: payload.totalCostBN,
                  filledBN: payload.filledBN,
                  ordersArr,
                  sigArr,
                  fillArr,
                  provider,
                  signer,
                  tokenContract,
                  proxyAddress: proxyAddressVal,
                  matchingMessage,
                  tTrading,
                  setOrderMsg,
                  setAmountInput,
                  refreshUserOrders,
                  toast,
                });
                return;
              }

              if (isAaEnabled()) {
                const ok = await submitMarketOrderWithAa({
                  market,
                  tradeSide,
                  amountBN,
                  filledBN: payload.filledBN,
                  ordersArr,
                  sigArr,
                  fillArr,
                  tokenContract,
                  signer,
                  matchingMessage,
                  tTrading,
                  setOrderMsg,
                  setAmountInput,
                  refreshUserOrders,
                  toast,
                });
                if (ok) return;
              }

              await submitMarketOrderDirect({
                market,
                tradeSide,
                amountBN,
                totalCostBN: payload.totalCostBN,
                filledBN: payload.filledBN,
                ordersArr,
                sigArr,
                fillArr,
                tokenContract,
                signer,
                account,
                matchingMessage,
                tTrading,
                setOrderMsg,
                setAmountInput,
                refreshUserOrders,
                toast,
              });
            } catch (e: any) {
              handleOrderError(e, setOrderMsg);
            } finally {
              setIsSubmitting(false);
            }
          },
        });
        setIsSubmitting(false);
        return;
      }

      if (orderMode === "limit" && editingOrderSalt) {
        await cancelOrder(editingOrderSalt);
        setEditingOrderSalt(null);
      }

      priceBN = parseUnitsByDecimals(priceFloat.toString(), decimals);

      await submitLimitOrder({
        market,
        account,
        predictionIdRaw,
        tradeSide,
        tradeOutcome,
        amountBN,
        priceBN,
        tif,
        postOnly,
        useProxyVal,
        proxyAddressVal,
        provider,
        signer,
        tokenContract,
        tTrading,
        setOrderMsg,
        setAmountInput,
        refreshUserOrders,
        toast,
      });
    } catch (e: any) {
      handleOrderError(e, setOrderMsg);
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
    marketConfirmOpen: marketConfirm.marketConfirmOpen,
    marketConfirmMessage: marketConfirm.marketConfirmMessage,
    cancelMarketConfirm,
    runMarketConfirm: marketConfirm.runMarketConfirm,
    closeMarketConfirm: marketConfirm.closeMarketConfirm,
    useProxy,
    setUseProxy,
    proxyAddress,
    proxyBalance,
    proxyShareBalance,
  };
}
