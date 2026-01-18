"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import { ethers } from "ethers";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/toast";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { useWallet } from "@/contexts/WalletContext";
import { erc20Abi } from "@/app/prediction/[id]/_lib/abis";
import { executeSafeTransaction } from "@/lib/safeUtils";
import { createBrowserProvider, ensureNetwork } from "@/app/prediction/[id]/_lib/wallet";

type WithdrawModalProps = {
  open: boolean;
  onClose: () => void;
};

type ProxyWalletInfo = {
  smart_account_address: string;
};

export default function WithdrawModal({ open, onClose }: WithdrawModalProps) {
  const { account, provider: walletProvider, switchNetwork } = useWallet();
  const runtime = useMemo(() => getRuntimeConfig(), []);
  const chainId = runtime.chainId;
  const usdcAddress = runtime.addresses.usdc || "";

  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyAddress, setProxyAddress] = useState<string | null>(null);

  const [balanceLoading, setBalanceLoading] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState<string>("USDC");
  const [tokenDecimals, setTokenDecimals] = useState<number>(6);
  const [rawBalance, setRawBalance] = useState<bigint>(0n);

  const [amount, setAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const fetchProxy = useCallback(async () => {
    if (!account) return;
    setProxyLoading(true);
    try {
      const res = await fetch("/api/wallets/proxy", { method: "POST" });
      const json = await res.json();
      if (json?.success && json?.data?.smart_account_address) {
        setProxyAddress(json.data.smart_account_address);
      } else {
        setProxyAddress(null);
      }
    } catch (e) {
      console.error(e);
      setProxyAddress(null);
    } finally {
      setProxyLoading(false);
    }
  }, [account]);

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
      const timer = setInterval(fetchBalance, 15000);
      return () => clearInterval(timer);
    }
  }, [open, proxyAddress, fetchBalance]);

  const balanceHuman = useMemo(() => {
    return ethers.formatUnits(rawBalance, tokenDecimals);
  }, [rawBalance, tokenDecimals]);

  const handleWithdraw = async () => {
    if (!account || !walletProvider || !proxyAddress || !usdcAddress) return;

    try {
      setIsWithdrawing(true);
      const amountBN = ethers.parseUnits(amount, tokenDecimals);
      if (amountBN <= 0n) {
        toast.error("请输入有效的提现金额");
        return;
      }
      if (amountBN > rawBalance) {
        toast.error("余额不足");
        return;
      }

      const provider = await createBrowserProvider(walletProvider);
      await ensureNetwork(provider, chainId, switchNetwork);
      const signer = await provider.getSigner();

      const erc20Iface = new ethers.Interface(erc20Abi);
      const transferData = erc20Iface.encodeFunctionData("transfer", [account, amountBN]);

      toast.info("请在钱包中确认提现交易...");

      const tx = await executeSafeTransaction(signer, proxyAddress, usdcAddress, transferData);

      toast.success("提现交易已发送", "资金将很快到达您的钱包");

      await tx.wait();
      fetchBalance();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error("提现失败", e?.message || "未知错误");
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
          <div className="text-lg font-bold text-gray-900">提现</div>
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
              <span>可提现余额</span>
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
            <p>• 资金将从您的 Proxy Wallet 提现到当前连接的钱包。</p>
            <p>• 提现需要您签署 Safe 交易。</p>
            <p>• 提现交易需消耗少量 Matic/ETH 作为网络 Gas 费。</p>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={isWithdrawing || !amount || parseFloat(amount) <= 0 || proxyLoading}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {isWithdrawing && <Loader2 className="w-4 h-4 animate-spin" />}
            {isWithdrawing ? "提现中..." : "确认提现"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
