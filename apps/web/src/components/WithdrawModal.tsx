"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { ethers } from "ethers";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/toast";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { useWallet } from "@/contexts/WalletContext";
import { erc20Abi } from "@/app/prediction/[id]/_lib/abis";
import { useTranslations } from "@/lib/i18n";

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
    }
  }, [open, fetchProxy]);

  useEffect(() => {
    if (open && proxyAddress) {
      fetchBalance();
      fetchOffchain();
      const timer = setInterval(fetchBalance, 15000);
      return () => clearInterval(timer);
    }
  }, [open, proxyAddress, fetchBalance, fetchOffchain]);

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

  const handleWithdraw = async () => {
    if (!address || !proxyAddress || !usdcAddress) return;

    try {
      setIsWithdrawing(true);
      const amountBN = ethers.parseUnits(amount, tokenDecimals);
      if (amountBN <= 0n) {
        toast.error(tWithdraw("errors.invalidAmount"));
        return;
      }
      if (amountBN > availableRawBalance) {
        toast.error(tWithdraw("errors.insufficientBalance"));
        return;
      }

      toast.success(tWithdraw("success"));
    } catch (e) {
      console.error(e);
      toast.error(tWithdraw("errors.withdrawalFailed"));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const setMax = () => {
    setAmount(balanceHuman);
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
        </div>
      </div>
    </Modal>
  );
}
