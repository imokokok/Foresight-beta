"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X, ArrowUpRight } from "lucide-react";
import { ethers } from "ethers";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/toast";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { useWallet } from "@/contexts/WalletContext";
import { erc20Abi } from "@/app/prediction/[id]/_lib/abis";
import { useTranslations } from "@/lib/i18n";

interface WithdrawalHistoryItem {
  id: string;
  amount: string;
  destination_address: string;
  transaction_hash: string;
  status: string;
  created_at: string;
}

type WithdrawModalProps = {
  open: boolean;
  onClose: () => void;
};

type ProxyWalletInfo = {
  smart_account_address: string;
};

export default function WithdrawModal({ open, onClose }: WithdrawModalProps) {
  const tWithdraw = useTranslations("withdrawModal");
  const tCommon = useTranslations("common");

  const { address: address } = useWallet();
  const runtime = useMemo(() => getRuntimeConfig(), []);
  const chainId = runtime.chainId;
  const usdcAddress = runtime.addresses.usdc || "";

  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyAddress, setProxyAddress] = useState<string | null>(null);

  const [balanceLoading, setBalanceLoading] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState<string>("USDC");
  const [tokenDecimals, setTokenDecimals] = useState<number>(6);
  const [rawBalance, setRawBalance] = useState<bigint>(0n);

  const [offchainLoading, setOffchainLoading] = useState(false);
  const [offchainOk, setOffchainOk] = useState(false);
  const [offchainBalance, setOffchainBalance] = useState<string>("0");
  const [offchainReserved, setOffchainReserved] = useState<string>("0");

  const [amount, setAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<WithdrawalHistoryItem[]>([]);

  const fetchProxy = useCallback(async () => {
    if (!address) return;
    setProxyLoading(true);
    try {
      const res = await fetch("/api/wallets/proxy", { method: "POST", credentials: "include" });
      const json = await res.json();
      if (json?.success && json?.data?.smart_account_address) {
        setProxyAddress(json.data.smart_account_address);
        setOffchainOk(false);
      } else {
        setProxyAddress(null);
        setOffchainOk(false);
      }
    } catch (e) {
      console.error(e);
      setProxyAddress(null);
      setOffchainOk(false);
    } finally {
      setProxyLoading(false);
    }
  }, [address]);

  const fetchOffchain = useCallback(async () => {
    if (!proxyAddress) return;
    setOffchainLoading(true);
    try {
      const url = new URL("/api/user-balance", window.location.origin);
      url.searchParams.set("address", proxyAddress);
      const res = await fetch(url.toString(), { method: "GET", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success && json?.data) {
        setOffchainOk(true);
        setOffchainBalance(String(json.data.balance ?? "0"));
        setOffchainReserved(String(json.data.reserved ?? "0"));
      } else {
        setOffchainOk(false);
      }
    } catch {
      setOffchainOk(false);
    } finally {
      setOffchainLoading(false);
    }
  }, [proxyAddress]);

  const fetchWithdrawalHistory = useCallback(async () => {
    if (!address) return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/withdraw", {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success && Array.isArray(json.data?.withdrawals)) {
        setHistory(json.data.withdrawals);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error("Failed to fetch withdrawal history:", error);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [address]);

  const fetchBalance = useCallback(async () => {
    if (!proxyAddress || !usdcAddress) return;
    setBalanceLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(runtime.rpcUrl);
      const token = new ethers.Contract(usdcAddress, erc20Abi, provider);
      const [dec, sym, bal] = await Promise.all([
        token.decimals().catch(() => 6),
        token.symbol().catch(() => "USDC"),
        token.balanceOf(proxyAddress),
      ]);
      setTokenDecimals(Number(dec));
      setTokenSymbol(String(sym));
      setRawBalance(BigInt(bal));
    } catch (e) {
      console.error(e);
      setRawBalance(0n);
    } finally {
      setBalanceLoading(false);
    }
  }, [proxyAddress, usdcAddress, runtime.rpcUrl]);

  useEffect(() => {
    if (open) {
      fetchProxy();
      setAmount("");
      fetchWithdrawalHistory();
    }
  }, [open, fetchProxy, fetchWithdrawalHistory]);

  useEffect(() => {
    if (open && proxyAddress) {
      fetchBalance();
      fetchOffchain();
      const timer = setInterval(fetchBalance, 15000);
      return () => clearInterval(timer);
    }
  }, [open, proxyAddress, fetchBalance, fetchOffchain]);

  // 手续费率（可以从配置中获取，这里暂时硬编码为0.1%）
  const FEE_RATE = 0.001;

  const availableRawBalance = useMemo(() => {
    if (!offchainOk) return rawBalance;
    try {
      const bal = ethers.parseUnits(String(offchainBalance || "0"), 6);
      const res = ethers.parseUnits(String(offchainReserved || "0"), 6);
      const avail = bal > res ? bal - res : 0n;
      return rawBalance < avail ? rawBalance : avail;
    } catch {
      return rawBalance;
    }
  }, [rawBalance, offchainOk, offchainBalance, offchainReserved]);

  const balanceHuman = useMemo(() => {
    return ethers.formatUnits(availableRawBalance, tokenDecimals);
  }, [availableRawBalance, tokenDecimals]);

  // 计算手续费
  const feeHuman = useMemo(() => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return "0";
    const fee = amountNum * FEE_RATE;
    return fee.toFixed(6);
  }, [amount]);

  // 计算实际到账金额
  const netAmountHuman = useMemo(() => {
    const amountNum = parseFloat(amount);
    const feeNum = parseFloat(feeHuman);
    return (amountNum - feeNum).toFixed(6);
  }, [amount, feeHuman]);

  // 计算扣除手续费后的实际可用余额
  const netAvailableBalance = useMemo(() => {
    const balanceNum = parseFloat(balanceHuman);
    // 计算扣除手续费后的最大可提取金额：maxAmount = balanceNum / (1 + FEE_RATE)
    const maxAmount = balanceNum / (1 + FEE_RATE);
    return maxAmount.toFixed(6);
  }, [balanceHuman]);

  // 计算最终可用余额
  const finalAvailableBalance = useMemo(() => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return balanceHuman;
    const availableNum = parseFloat(balanceHuman);
    const feeNum = amountNum * FEE_RATE;
    const totalNum = amountNum + feeNum;
    return (availableNum - totalNum).toFixed(6);
  }, [amount, balanceHuman]);

  const handleWithdraw = async () => {
    if (!address || !proxyAddress || !usdcAddress) return;

    try {
      setIsWithdrawing(true);
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        toast.error(tWithdraw("errors.invalidAmount"));
        return;
      }

      // 计算总金额（包括手续费）
      const feeNum = amountNum * FEE_RATE;
      const totalNum = amountNum + feeNum;

      // 检查余额是否足够支付总金额
      const availableNum = parseFloat(balanceHuman);
      if (totalNum > availableNum) {
        toast.error(tWithdraw("errors.insufficientBalance"));
        return;
      }

      const amountBN = ethers.parseUnits(amount, tokenDecimals);

      // 调用取款API
      const response = await fetch("/api/withdraw", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          destination: address,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(tWithdraw("success"), result.message || "取款请求已提交");
        if (result.transactionHash) {
          console.log("Withdrawal transaction hash:", result.transactionHash);
        }
        // 刷新余额和历史记录
        fetchBalance();
        fetchOffchain();
        fetchWithdrawalHistory();
        setAmount("");
      } else {
        toast.error(tWithdraw("errors.withdrawalFailed"), result.message || "取款失败");
      }
    } catch (e) {
      console.error(e);
      toast.error(tWithdraw("errors.withdrawalFailed"), "网络错误，请稍后重试");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const setMax = () => {
    // 设置扣除手续费后的最大可提取金额
    setAmount(netAvailableBalance);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      ariaLabelledby="withdraw-modal-title"
      containerClassName="flex items-center justify-center px-4"
    >
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="text-lg font-bold text-gray-900">{tWithdraw("title")}</div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <div className="text-sm text-gray-500 flex justify-between">
              <span>{tWithdraw("availableBalance")}</span>
              <span className="font-mono font-medium text-gray-900">
                {balanceLoading ? "..." : balanceHuman} {tokenSymbol}
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-3xl font-bold bg-transparent border-none focus:ring-0 p-0 placeholder-gray-200 text-gray-900"
              />
              <button
                onClick={setMax}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg hover:bg-purple-100 transition-colors"
              >
                MAX
              </button>
            </div>
            <div className="h-px bg-gray-100 w-full" />

            {/* 手续费信息 */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>{tWithdraw("fee")}</span>
                <span className="font-mono">
                  {feeHuman} {tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{tWithdraw("netAmount")}</span>
                <span className="font-mono font-medium">
                  {netAmountHuman} {tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{tWithdraw("feeRate")}</span>
                <span>{(FEE_RATE * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
            <p>{tWithdraw("tips.line1")}</p>
            <p>{tWithdraw("tips.line2")}</p>
            <p>{tWithdraw("tips.line3")}</p>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={
              isWithdrawing ||
              !amount ||
              parseFloat(amount) <= 0 ||
              proxyLoading ||
              balanceLoading ||
              (offchainOk && offchainLoading)
            }
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {isWithdrawing && <Loader2 className="w-4 h-4 animate-spin" />}
            {isWithdrawing ? tWithdraw("withdrawing") : tCommon("confirm")}
          </button>

          {/* 取款历史记录 */}
          <div className="pt-4 mt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">{tWithdraw("history.title")}</h3>
              <button
                onClick={fetchWithdrawalHistory}
                disabled={historyLoading}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50"
              >
                {historyLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                {tCommon("refresh")}
              </button>
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-4 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">
                {tWithdraw("history.empty")}
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-gray-900">
                          -{item.amount} {tokenSymbol}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            item.status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {item.status === "pending"
                            ? tWithdraw("history.pending")
                            : tWithdraw("history.confirmed")}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                    {item.transaction_hash && (
                      <button
                        onClick={() => {
                          // 这里可以添加查看交易详情的逻辑，比如跳转到区块链浏览器
                          console.log("View transaction:", item.transaction_hash);
                        }}
                        className="text-purple-600 hover:text-purple-800 transition-colors"
                        aria-label={tCommon("view")}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
