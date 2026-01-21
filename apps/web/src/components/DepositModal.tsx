"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Coins,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
  ShieldCheck,
} from "lucide-react";
import { ethers } from "ethers";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/toast";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { formatTranslation, useTranslations } from "@/lib/i18n";

type DepositModalProps = {
  open: boolean;
  onClose: () => void;
  onRequireLogin: () => void;
};

type ProxyWalletInfo = {
  chain_id: number;
  owner_eoa: string;
  smart_account_address: string;
  deployment_status?: "deployed" | "not_deployed" | "unknown";
  address: string;
  type: string;
};

type DepositHistoryItem = {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  value: string;
  valueFormatted: string;
  timestamp?: number;
  explorerUrl?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  status?: "pending" | "confirmed";
};

const erc20ReadAbi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

function explorerBaseByChain(chainId: number) {
  switch (Number(chainId)) {
    case 1:
      return "https://etherscan.io";
    case 11155111:
      return "https://sepolia.etherscan.io";
    case 137:
      return "https://polygonscan.com";
    case 80002:
      return "https://amoy.polygonscan.com";
    case 56:
      return "https://bscscan.com";
    default:
      return "https://etherscan.io";
  }
}

function chainLabel(chainId: number) {
  switch (Number(chainId)) {
    case 137:
      return "Polygon";
    case 80002:
      return "Polygon Amoy";
    case 11155111:
      return "Sepolia";
    case 1:
      return "Ethereum";
    default:
      return `Chain ${chainId}`;
  }
}

function shortAddress(addr: string) {
  const a = String(addr || "");
  if (!a.startsWith("0x") || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function buildTemplateUrl(
  template: string,
  params: Record<string, string | number | undefined | null>
) {
  let out = String(template || "");
  const entries = Object.entries(params);
  for (const [k, v] of entries) {
    out = out.replaceAll(`{${k}}`, v == null ? "" : String(v));
  }
  return out;
}

export default function DepositModal({ open, onClose, onRequireLogin }: DepositModalProps) {
  const tDeposit = useTranslations("depositModal");
  const tWallet = useTranslations("wallet");
  const tCommon = useTranslations("common");

  const runtime = useMemo(() => getRuntimeConfig(), []);
  const chainId = runtime.chainId;
  const usdcAddress = runtime.addresses.usdc || "";
  const explorerBase = useMemo(() => explorerBaseByChain(chainId), [chainId]);

  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [proxyInfo, setProxyInfo] = useState<ProxyWalletInfo | null>(null);

  const [balanceLoading, setBalanceLoading] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState<string>("USDC");
  const [tokenDecimals, setTokenDecimals] = useState<number>(6);
  const [rawBalance, setRawBalance] = useState<bigint>(0n);

  const lastSeenBalanceRef = useRef<bigint>(0n);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [history, setHistory] = useState<DepositHistoryItem[]>([]);

  const historyInitRef = useRef(false);
  const historySnapshotRef = useRef<Map<string, string>>(new Map());

  const onrampTemplate = String(process.env.NEXT_PUBLIC_ONRAMP_URL_TEMPLATE || "").trim();

  const fetchProxy = useCallback(async () => {
    setProxyLoading(true);
    setProxyError(null);
    try {
      const res = await fetch("/api/wallets/proxy", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        setProxyInfo(null);
        setProxyError(tDeposit("errors.loginRequiredForAddress"));
        onClose();
        onRequireLogin();
        return;
      }
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setProxyInfo(null);
        setProxyError(String(json?.message || tDeposit("errors.fetchAddressFailed")));
        return;
      }
      const info = json?.data as ProxyWalletInfo;
      if (!info?.smart_account_address) {
        setProxyInfo(null);
        setProxyError(tDeposit("errors.addressUnavailable"));
        return;
      }
      setProxyInfo(info);
    } catch (e: any) {
      setProxyInfo(null);
      setProxyError(String(e?.message || tDeposit("errors.fetchAddressFailed")));
    } finally {
      setProxyLoading(false);
    }
  }, [onClose, onRequireLogin, tDeposit]);

  const fetchBalance = useCallback(
    async (address: string) => {
      if (!address) return;
      if (!usdcAddress) {
        setBalanceLoading(false);
        return;
      }
      setBalanceLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(runtime.rpcUrl);
        const token = new ethers.Contract(usdcAddress, erc20ReadAbi, provider);
        const [dec, sym, bal] = await Promise.all([
          token.decimals().catch(() => 6),
          token.symbol().catch(() => "USDC"),
          token.balanceOf(address),
        ]);
        const decimals = Number(dec) || 6;
        setTokenDecimals(decimals);
        setTokenSymbol(String(sym || "USDC"));
        const nextBal = BigInt(bal);
        setRawBalance(nextBal);

        const prev = lastSeenBalanceRef.current;
        if (nextBal > prev && prev > 0n) {
          const diff = nextBal - prev;
          const diffHuman = ethers.formatUnits(diff, decimals);
          toast.success(
            tDeposit("toast.depositArrivedTitle"),
            formatTranslation(tDeposit("toast.depositArrivedDescription"), {
              amount: diffHuman,
              symbol: String(sym || "USDC"),
            })
          );
        }
        lastSeenBalanceRef.current = nextBal;
      } catch (e: any) {
        setRawBalance(0n);
      } finally {
        setBalanceLoading(false);
      }
    },
    [runtime.rpcUrl, usdcAddress, tDeposit]
  );

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/deposits/history", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        setHistory([]);
        setHistoryError(tDeposit("errors.loginRequiredForHistory"));
        onClose();
        onRequireLogin();
        return;
      }
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setHistory([]);
        setHistoryError(String(json?.message || tDeposit("errors.loadHistoryFailed")));
        return;
      }
      const items = Array.isArray(json?.data?.items)
        ? (json.data.items as DepositHistoryItem[])
        : [];
      const mapped = items.map((it) => ({
        ...it,
        explorerUrl: `${explorerBase}/tx/${it.txHash}`,
      }));
      const nextMap = new Map<string, string>();
      if (!historyInitRef.current) {
        historyInitRef.current = true;
        for (const it of mapped) {
          if (it.txHash) nextMap.set(it.txHash, it.status || "pending");
        }
      } else {
        for (const it of mapped) {
          if (!it.txHash) continue;
          const nextStatus = it.status || "pending";
          const prevStatus = historySnapshotRef.current.get(it.txHash);
          nextMap.set(it.txHash, nextStatus);
          if (!prevStatus) {
            const amount = it.valueFormatted || "0";
            const symbol = tokenSymbol || "USDC";
            if (nextStatus === "confirmed") {
              toast.success(
                tDeposit("toast.depositConfirmedTitle"),
                formatTranslation(tDeposit("toast.depositConfirmedDescription"), { amount, symbol })
              );
            } else {
              toast.info(
                tDeposit("toast.depositPendingTitle"),
                formatTranslation(tDeposit("toast.depositPendingDescription"), { amount, symbol })
              );
            }
          } else if (prevStatus === "pending" && nextStatus === "confirmed") {
            const amount = it.valueFormatted || "0";
            const symbol = tokenSymbol || "USDC";
            toast.success(
              tDeposit("toast.depositConfirmedTitle"),
              formatTranslation(tDeposit("toast.depositConfirmedDescription"), { amount, symbol })
            );
          }
        }
      }
      historySnapshotRef.current = nextMap;
      setHistory(mapped);
    } catch (e: any) {
      setHistory([]);
      setHistoryError(String(e?.message || tDeposit("errors.loadHistoryFailed")));
    } finally {
      setHistoryLoading(false);
    }
  }, [explorerBase, onClose, onRequireLogin, tDeposit, tokenSymbol]);

  useEffect(() => {
    if (!open) return;
    setProxyInfo(null);
    setProxyError(null);
    setHistory([]);
    setHistoryError(null);
    setRawBalance(0n);
    lastSeenBalanceRef.current = 0n;
    historyInitRef.current = false;
    historySnapshotRef.current = new Map();
    void fetchProxy();
  }, [open, fetchProxy]);

  useEffect(() => {
    if (!open) return;
    if (!proxyInfo?.smart_account_address) return;
    void fetchBalance(proxyInfo.smart_account_address);
    void fetchHistory();
    const timer = setInterval(() => {
      void fetchBalance(proxyInfo.smart_account_address);
      void fetchHistory();
    }, 15000);
    return () => clearInterval(timer);
  }, [open, proxyInfo?.smart_account_address, fetchBalance, fetchHistory]);

  const balanceHuman = useMemo(() => {
    try {
      return ethers.formatUnits(rawBalance, tokenDecimals);
    } catch {
      return "0";
    }
  }, [rawBalance, tokenDecimals]);

  const depositAddress = proxyInfo?.smart_account_address || "";
  const depositAddressExplorer = depositAddress ? `${explorerBase}/address/${depositAddress}` : "";

  const onrampUrl = useMemo(() => {
    if (!onrampTemplate || !depositAddress) return "";
    return buildTemplateUrl(onrampTemplate, {
      address: depositAddress,
      chainId,
      network: encodeURIComponent(chainLabel(chainId)),
      asset: tokenSymbol,
    });
  }, [onrampTemplate, depositAddress, chainId, tokenSymbol]);

  const copyDepositAddress = async () => {
    if (!depositAddress) return;
    try {
      await navigator.clipboard.writeText(depositAddress);
      toast.success(tWallet("addressCopied"));
    } catch {
      toast.error(tDeposit("errors.copyFailedTitle"), tDeposit("errors.copyFailedDescription"));
    }
  };

  const openUrl = (url: string) => {
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
  };

  const requireLogin = () => {
    onClose();
    onRequireLogin();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="fullscreen"
      ariaLabelledby="deposit-modal-title"
      ariaDescribedby="deposit-modal-description"
      backdropClassName="bg-gradient-to-br from-black/40 via-purple-900/20 to-pink-900/20 backdrop-blur-md"
      containerClassName="flex items-center justify-center px-4"
    >
      <div className="relative bg-gradient-to-br from-white via-white to-purple-50/50 rounded-3xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden border border-white/20 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-100/60">
          <div className="min-w-0">
            <div
              id="deposit-modal-title"
              className="text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
            >
              {tDeposit("title")}
            </div>
            <div id="deposit-modal-description" className="text-xs text-gray-500 mt-0.5">
              {formatTranslation(tDeposit("subtitle"), {
                network: chainLabel(chainId),
                asset: tokenSymbol,
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-purple-50 text-gray-600 hover:text-gray-900 transition-colors"
            aria-label={tCommon("close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-0">
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xs text-purple-900">
              <span className="font-bold">{tDeposit("smartAccount.title")}</span>
              <br />
              {formatTranslation(tDeposit("smartAccount.description"), { asset: tokenSymbol })}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-purple-100 bg-white/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-700">
                  {tDeposit("address.title")}
                </div>
                <div className="mt-1 font-mono text-sm text-gray-900 break-all">
                  {proxyLoading ? (
                    <span className="inline-flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {tDeposit("address.loading")}
                    </span>
                  ) : depositAddress ? (
                    depositAddress
                  ) : (
                    <span className="text-gray-500">--</span>
                  )}
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  {formatTranslation(tDeposit("address.warning"), {
                    asset: tokenSymbol,
                    network: chainLabel(chainId),
                  })}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] text-gray-500">{tWallet("balance")}</div>
                  <div className="text-lg font-bold text-gray-900 tabular-nums">
                    {balanceLoading ? "…" : balanceHuman}
                  </div>
                  <div className="text-[10px] text-gray-500">{tokenSymbol}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyDepositAddress}
                    disabled={!depositAddress}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700 disabled:opacity-50"
                  >
                    <Copy className="w-4 h-4" />
                    {tWallet("copyAddress")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openUrl(depositAddressExplorer)}
                    disabled={!depositAddress}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700 disabled:opacity-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {tWallet("viewOnExplorer")}
                  </button>
                  <button
                    type="button"
                    onClick={() => depositAddress && fetchBalance(depositAddress)}
                    disabled={!depositAddress || balanceLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${balanceLoading ? "animate-spin" : ""}`} />
                    {tCommon("refresh")}
                  </button>
                </div>
              </div>
            </div>

            {proxyError && (
              <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{proxyError}</span>
                <button
                  type="button"
                  onClick={requireLogin}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-red-200 hover:border-red-300"
                >
                  {tDeposit("actions.goLogin")} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!proxyError && !usdcAddress && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
                {tDeposit("errors.usdcNotConfigured")}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Coins className="w-4 h-4 text-purple-600" />
                {tDeposit("methods.onchain.title")}
              </div>
              <ol className="mt-2 text-xs text-gray-600 space-y-1 list-decimal list-inside">
                <li>
                  {formatTranslation(tDeposit("methods.onchain.step1"), {
                    network: chainLabel(chainId),
                  })}
                </li>
                <li>
                  {formatTranslation(tDeposit("methods.onchain.step2"), { asset: tokenSymbol })}
                </li>
                <li>{tDeposit("methods.onchain.step3")}</li>
                <li>{tDeposit("methods.onchain.step4")}</li>
              </ol>
              <div className="mt-3 text-[11px] text-gray-500">
                {tDeposit("methods.onchain.tip")}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Coins className="w-4 h-4 text-purple-600" />
                {tDeposit("methods.exchange.title")}
              </div>
              <ol className="mt-2 text-xs text-gray-600 space-y-1 list-decimal list-inside">
                <li>
                  {formatTranslation(tDeposit("methods.exchange.step1"), { asset: tokenSymbol })}
                </li>
                <li>
                  {formatTranslation(tDeposit("methods.exchange.step2"), {
                    network: chainLabel(chainId),
                  })}
                </li>
                <li>{tDeposit("methods.exchange.step3")}</li>
                <li>{tDeposit("methods.exchange.step4")}</li>
              </ol>
              <div className="mt-3 text-[11px] text-gray-500">
                {tDeposit("methods.exchange.risk")}
              </div>
            </div>
          </div>

          {!!onrampUrl && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">{tDeposit("onramp.title")}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {formatTranslation(tDeposit("onramp.description"), { asset: tokenSymbol })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openUrl(onrampUrl)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md hover:shadow-lg transition-all active:scale-95"
                >
                  {tDeposit("onramp.cta")} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100">
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-gray-900">{tDeposit("history.title")}</div>
                <button
                  type="button"
                  onClick={() => void fetchHistory()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
                >
                  <RefreshCw className={`w-4 h-4 ${historyLoading ? "animate-spin" : ""}`} />
                  {tCommon("refresh")}
                </button>
              </div>

              {historyError && (
                <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
                  {historyError}
                </div>
              )}

              {!historyError && history.length === 0 && (
                <div className="mt-3 text-xs text-gray-500">
                  {historyLoading ? tCommon("loading") : tDeposit("history.empty")}
                </div>
              )}

              {!historyError && history.length > 0 && (
                <div className="mt-3 divide-y divide-gray-100">
                  {history.slice(0, 20).map((it) => (
                    <div
                      key={`${it.txHash}:${it.blockNumber}`}
                      className="py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold text-gray-900 tabular-nums">
                            +{it.valueFormatted} {tokenSymbol}
                          </div>
                          {it.status ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                it.status === "confirmed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {it.status === "confirmed"
                                ? tDeposit("history.statusConfirmed")
                                : tDeposit("history.statusPending")}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {formatTranslation(tDeposit("history.itemMeta"), {
                            from: shortAddress(it.from),
                            block: it.blockNumber,
                          })}
                          {it.status ? (
                            <>
                              {it.confirmations != null && it.requiredConfirmations ? (
                                <>
                                  {" · "}
                                  {formatTranslation(tDeposit("history.confirmations"), {
                                    confirmations: it.confirmations,
                                    required: it.requiredConfirmations,
                                  })}
                                </>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => it.explorerUrl && openUrl(it.explorerUrl)}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700 text-xs"
                      >
                        {tDeposit("history.details")} <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="text-sm font-bold text-gray-900">{tDeposit("bridge.title")}</div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => openUrl("https://wallet.polygon.technology/polygon/bridge")}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
                >
                  Polygon Bridge
                </button>
                <button
                  type="button"
                  onClick={() => openUrl("https://across.to/")}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
                >
                  Across
                </button>
                <button
                  type="button"
                  onClick={() => openUrl("https://jumper.exchange/")}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
                >
                  Jumper
                </button>
              </div>
              <div className="mt-2 text-[11px] text-gray-500">
                {formatTranslation(tDeposit("bridge.risk"), { asset: tokenSymbol })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
