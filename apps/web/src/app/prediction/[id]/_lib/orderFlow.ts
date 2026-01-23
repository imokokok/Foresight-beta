import { ethers } from "ethers";
import { API_BASE, RELAYER_BASE } from "./constants";
import { safeJson } from "./http";
import { createOrderDomain } from "@/lib/orderVerification";
import { ORDER_TYPES } from "@/types/market";
import { executeSafeTransaction } from "@/lib/safeUtils";
import { erc1155Abi, erc20Abi, marketAbi } from "./abis";
import { trySubmitAaCalls } from "./aaUtils";
import type { MarketInfo } from "./marketTypes";

type Translator = (key: string) => string;

type ToastApi = {
  success: (title: string, desc?: string) => void;
};

type SetState<T> = (value: T) => void;

async function reportTrade(chainId: number, txHash: string, contract: string) {
  try {
    await fetch(`${API_BASE}/orderbook/report-trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainId, txHash, contract }),
    });
  } catch {}
}

async function ensureProxyActivated(provider: ethers.BrowserProvider, proxyAddress: string) {
  const code = await provider.getCode(proxyAddress);
  if (!code || code === "0x") {
    throw new Error("Proxy wallet not activated. Please deposit funds first to activate.");
  }
}

export async function submitMarketOrderWithProxy({
  market,
  tradeSide,
  amountBN,
  totalCostBN,
  filledBN,
  ordersArr,
  sigArr,
  fillArr,
  provider,
  signer,
  tokenContract,
  proxyAddress,
  matchingMessage,
  tTrading,
  setOrderMsg,
  setAmountInput,
  refreshUserOrders,
  toast,
}: {
  market: MarketInfo;
  tradeSide: "buy" | "sell";
  amountBN: bigint;
  totalCostBN: bigint;
  filledBN: bigint;
  ordersArr: any[];
  sigArr: string[];
  fillArr: bigint[];
  provider: ethers.BrowserProvider;
  signer: ethers.Signer;
  tokenContract: any;
  proxyAddress: string;
  matchingMessage?: string;
  tTrading: Translator;
  setOrderMsg: SetState<string | null>;
  setAmountInput: SetState<string>;
  refreshUserOrders: () => Promise<void>;
  toast: ToastApi;
}) {
  await ensureProxyActivated(provider, proxyAddress);

  if (tradeSide === "buy") {
    const allowance = await tokenContract.allowance(proxyAddress, market.market);
    if (allowance < totalCostBN) {
      setOrderMsg(tTrading("orderFlow.approving"));
      const erc20Iface = new ethers.Interface(erc20Abi);
      const approveData = erc20Iface.encodeFunctionData("approve", [
        market.market,
        ethers.MaxUint256,
      ]);
      const tx = await executeSafeTransaction(
        signer,
        proxyAddress,
        String(tokenContract.target),
        approveData
      );
      await tx.wait();
    }
  } else {
    const marketContract = new ethers.Contract(market.market, marketAbi, provider);
    const outcomeTokenAddress = await marketContract.outcomeToken();
    const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, provider);
    const isApproved = await outcome1155.isApprovedForAll(proxyAddress, market.market);
    if (!isApproved) {
      setOrderMsg(tTrading("orderFlow.outcomeTokenApproving"));
      const erc1155Iface = new ethers.Interface(erc1155Abi);
      const approveData = erc1155Iface.encodeFunctionData("setApprovalForAll", [
        market.market,
        true,
      ]);
      const tx = await executeSafeTransaction(
        signer,
        proxyAddress,
        String(outcomeTokenAddress),
        approveData
      );
      await tx.wait();
    }
  }

  setOrderMsg(matchingMessage ?? tTrading("orderFlow.matchingInProgress"));
  const marketIface = new ethers.Interface(marketAbi);
  const batchFillData = marketIface.encodeFunctionData("batchFill", [ordersArr, sigArr, fillArr]);
  const tx = await executeSafeTransaction(signer, proxyAddress, market.market, batchFillData);
  const receipt = await tx.wait();
  await reportTrade(market.chain_id, receipt.hash, market.market);
  setOrderMsg(
    filledBN < amountBN ? tTrading("orderFlow.partialFilled") : tTrading("orderFlow.filled")
  );
  setAmountInput("");
  await refreshUserOrders();
  toast.success(tTrading("toast.orderSuccessTitle"), tTrading("toast.orderSuccessDesc"));
}

export async function submitMarketOrderWithAa({
  market,
  tradeSide,
  amountBN,
  filledBN,
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
}: {
  market: MarketInfo;
  tradeSide: "buy" | "sell";
  amountBN: bigint;
  filledBN: bigint;
  ordersArr: any[];
  sigArr: string[];
  fillArr: bigint[];
  tokenContract: any;
  signer: ethers.Signer;
  matchingMessage?: string;
  tTrading: Translator;
  setOrderMsg: SetState<string | null>;
  setAmountInput: SetState<string>;
  refreshUserOrders: () => Promise<void>;
  toast: ToastApi;
}) {
  try {
    const calls = [];
    if (tradeSide === "buy") {
      const erc20Iface = new ethers.Interface(erc20Abi);
      const approveData = erc20Iface.encodeFunctionData("approve", [
        market.market,
        ethers.MaxUint256,
      ]);
      calls.push({ to: String(tokenContract.target), data: approveData });
    } else {
      const marketContract = new ethers.Contract(market.market, marketAbi, signer);
      const outcomeTokenAddress = await marketContract.outcomeToken();
      const erc1155Iface = new ethers.Interface(erc1155Abi);
      const approveData = erc1155Iface.encodeFunctionData("setApprovalForAll", [
        market.market,
        true,
      ]);
      calls.push({ to: outcomeTokenAddress, data: approveData });
    }

    const marketIface = new ethers.Interface(marketAbi);
    const batchFillData = marketIface.encodeFunctionData("batchFill", [ordersArr, sigArr, fillArr]);
    calls.push({ to: market.market, data: batchFillData });

    setOrderMsg(matchingMessage ?? tTrading("orderFlow.matchingInProgress"));
    const res = await trySubmitAaCalls({ chainId: market.chain_id, calls });
    const txHash = res?.txHash || "";
    if (txHash) {
      await reportTrade(market.chain_id, txHash, market.market);
    }
    setOrderMsg(
      filledBN < amountBN ? tTrading("orderFlow.partialFilled") : tTrading("orderFlow.filled")
    );
    setAmountInput("");
    await refreshUserOrders();
    toast.success(tTrading("toast.orderSuccessTitle"), tTrading("toast.orderSuccessDesc"));
    return true;
  } catch (e: any) {
    console.error("AA batchFill failed", e);
    return false;
  }
}

export async function submitMarketOrderWithAaReadonly({
  market,
  tradeSide,
  amountBN,
  filledBN,
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
}: {
  market: MarketInfo;
  tradeSide: "buy" | "sell";
  amountBN: bigint;
  filledBN: bigint;
  ordersArr: any[];
  sigArr: string[];
  fillArr: bigint[];
  collateralToken: string;
  readProvider: ethers.JsonRpcProvider;
  matchingMessage?: string;
  tTrading: Translator;
  setOrderMsg: SetState<string | null>;
  setAmountInput: SetState<string>;
  refreshUserOrders: () => Promise<void>;
  toast: ToastApi;
}) {
  const calls = [];
  if (tradeSide === "buy") {
    const erc20Iface = new ethers.Interface(erc20Abi);
    const approveData = erc20Iface.encodeFunctionData("approve", [
      market.market,
      ethers.MaxUint256,
    ]);
    calls.push({ to: collateralToken, data: approveData });
  } else {
    const marketContract = new ethers.Contract(market.market, marketAbi, readProvider);
    const outcomeTokenAddress = await marketContract.outcomeToken();
    const erc1155Iface = new ethers.Interface(erc1155Abi);
    const approveData = erc1155Iface.encodeFunctionData("setApprovalForAll", [market.market, true]);
    calls.push({ to: String(outcomeTokenAddress), data: approveData });
  }

  const marketIface = new ethers.Interface(marketAbi);
  const batchFillData = marketIface.encodeFunctionData("batchFill", [ordersArr, sigArr, fillArr]);
  calls.push({ to: market.market, data: batchFillData });

  setOrderMsg(matchingMessage ?? tTrading("orderFlow.matchingInProgress"));
  const res = await trySubmitAaCalls({ chainId: market.chain_id, calls });
  const txHash = res?.txHash || "";
  if (txHash) {
    await reportTrade(market.chain_id, txHash, market.market);
  }
  setOrderMsg(
    filledBN < amountBN ? tTrading("orderFlow.partialFilled") : tTrading("orderFlow.filled")
  );
  setAmountInput("");
  await refreshUserOrders();
  toast.success(tTrading("toast.orderSuccessTitle"), tTrading("toast.orderSuccessDesc"));
}

export async function submitMarketOrderDirect({
  market,
  tradeSide,
  amountBN,
  totalCostBN,
  filledBN,
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
}: {
  market: MarketInfo;
  tradeSide: "buy" | "sell";
  amountBN: bigint;
  totalCostBN: bigint;
  filledBN: bigint;
  ordersArr: any[];
  sigArr: string[];
  fillArr: bigint[];
  tokenContract: any;
  signer: ethers.Signer;
  account: string;
  matchingMessage?: string;
  tTrading: Translator;
  setOrderMsg: SetState<string | null>;
  setAmountInput: SetState<string>;
  refreshUserOrders: () => Promise<void>;
  toast: ToastApi;
}) {
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
  setOrderMsg(matchingMessage ?? tTrading("orderFlow.matchingInProgress"));
  const tx = await marketContract.batchFill(ordersArr, sigArr, fillArr);
  const receipt = await tx.wait();
  await reportTrade(market.chain_id, receipt.hash, market.market);
  setOrderMsg(
    filledBN < amountBN ? tTrading("orderFlow.partialFilled") : tTrading("orderFlow.filled")
  );
  setAmountInput("");
  await refreshUserOrders();
  toast.success(tTrading("toast.orderSuccessTitle"), tTrading("toast.orderSuccessDesc"));
}

export async function submitLimitOrder({
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
}: {
  market: MarketInfo;
  account: string;
  predictionIdRaw: string | number;
  tradeSide: "buy" | "sell";
  tradeOutcome: number;
  amountBN: bigint;
  priceBN: bigint;
  tif: "GTC" | "IOC" | "FOK";
  postOnly: boolean;
  useProxyVal: boolean;
  proxyAddressVal?: string;
  provider: ethers.BrowserProvider;
  signer: ethers.Signer;
  tokenContract: any;
  tTrading: Translator;
  setOrderMsg: SetState<string | null>;
  setAmountInput: SetState<string>;
  refreshUserOrders: () => Promise<void>;
  toast: ToastApi;
}) {
  if (tradeSide === "buy") {
    const cost = (amountBN * priceBN) / 1_000_000_000_000_000_000n;
    if (useProxyVal && proxyAddressVal) {
      await ensureProxyActivated(provider, proxyAddressVal);
      const allowance = await tokenContract.allowance(proxyAddressVal, market.market);
      if (allowance < cost) {
        setOrderMsg(tTrading("orderFlow.approving"));
        const erc20Iface = new ethers.Interface(erc20Abi);
        const approveData = erc20Iface.encodeFunctionData("approve", [
          market.market,
          ethers.MaxUint256,
        ]);
        const tx = await executeSafeTransaction(
          signer,
          proxyAddressVal,
          String(tokenContract.target),
          approveData
        );
        await tx.wait();
        setOrderMsg(tTrading("orderFlow.approveThenPlace"));
      }
    } else {
      const allowance = await tokenContract.allowance(account, market.market);
      if (allowance < cost) {
        setOrderMsg(tTrading("orderFlow.approving"));
        const tx = await tokenContract.approve(market.market, ethers.MaxUint256);
        await tx.wait();
        setOrderMsg(tTrading("orderFlow.approveThenPlace"));
      }
    }
  } else {
    const marketContract = new ethers.Contract(market.market, marketAbi, signer);
    const outcomeTokenAddress = await marketContract.outcomeToken();
    const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);
    if (useProxyVal && proxyAddressVal) {
      await ensureProxyActivated(provider, proxyAddressVal);
      const isApproved = await outcome1155.isApprovedForAll(proxyAddressVal, market.market);
      if (!isApproved) {
        setOrderMsg(tTrading("orderFlow.outcomeTokenApproving"));
        const erc1155Iface = new ethers.Interface(erc1155Abi);
        const approveData = erc1155Iface.encodeFunctionData("setApprovalForAll", [
          market.market,
          true,
        ]);
        const tx = await executeSafeTransaction(
          signer,
          proxyAddressVal,
          String(outcomeTokenAddress),
          approveData
        );
        await tx.wait();
        setOrderMsg(tTrading("orderFlow.approveThenPlace"));
      }
    } else {
      const isApproved = await outcome1155.isApprovedForAll(account, market.market);
      if (!isApproved) {
        setOrderMsg(tTrading("orderFlow.outcomeTokenApproving"));
        const tx = await outcome1155.setApprovalForAll(market.market, true);
        await tx.wait();
        setOrderMsg(tTrading("orderFlow.approveThenPlace"));
      }
    }
  }

  const salt = (() => {
    try {
      const c = globalThis.crypto;
      if (!c || typeof c.getRandomValues !== "function") {
        return String(Date.now());
      }
      const arr = new Uint32Array(2);
      c.getRandomValues(arr);
      return ((BigInt(arr[0]) << 32n) | BigInt(arr[1])).toString();
    } catch {
      return String(Date.now());
    }
  })();
  const expiry = Math.floor(Date.now() / 1000) + 3600 * 24;

  const orderMaker = useProxyVal && proxyAddressVal ? proxyAddressVal : account;
  const value = {
    maker: orderMaker,
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
      maker: orderMaker,
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
      const errorCode = String(
        (jsonV2 as any)?.errorCode || (jsonV2 as any)?.error?.code || ""
      ).toUpperCase();
      if (errorCode === "MARKET_CLOSED") {
        setOrderMsg(tTrading("orderFlow.marketClosed"));
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
    const errorCode = String(json?.error?.code || json?.errorCode || "").toUpperCase();
    if (errorCode === "MARKET_CLOSED") {
      setOrderMsg(tTrading("orderFlow.marketClosed"));
      return;
    }
    throw new Error(json.message || tTrading("orderFlow.orderFailedFallback"));
  }
}
