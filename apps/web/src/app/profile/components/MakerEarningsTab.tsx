"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { Coins, ExternalLink, RefreshCw } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useTranslations } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { getFallbackRpcUrl } from "@/lib/walletProviderUtils";
import { ProfileCard } from "./ProfileUI";
import { erc20Abi, lpFeeStakingAbi } from "@/app/prediction/[id]/_lib/abis";
import { resolveMakerRewardAddresses } from "@/app/prediction/[id]/_lib/wallet";

type MakerEarningsTabProps = {
  address: string | null | undefined;
  isOwnProfile?: boolean;
};

type ViewState = {
  chainId: number | null;
  foresightAddress: string | null;
  lpFeeStakingAddress: string | null;
  rewardTokenAddress: string | null;
  foresightDecimals: number | null;
  rewardDecimals: number | null;
  foresightWalletBalance: bigint | null;
  foresightStakedBalance: bigint | null;
  pendingReward: bigint | null;
};

function formatAmount(amount: bigint | null, decimals: number | null) {
  if (amount == null || decimals == null) return "--";
  const n = Number(ethers.formatUnits(amount, decimals));
  if (!Number.isFinite(n)) return "--";
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  if (n < 1) return n.toFixed(4);
  if (n < 1000) return n.toFixed(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function MakerEarningsTab({ address, isOwnProfile = false }: MakerEarningsTabProps) {
  const tProfile = useTranslations("profile");
  const { provider: rawProvider, chainId: chainIdHex, address: connectedAccount } = useWallet();

  const [fallbackChainIdHex, setFallbackChainIdHex] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (chainIdHex) {
        if (!cancelled) setFallbackChainIdHex(null);
        return;
      }
      if (!rawProvider?.request) return;
      try {
        const hex = await rawProvider.request({ method: "eth_chainId" });
        if (!cancelled && typeof hex === "string") setFallbackChainIdHex(hex);
      } catch {}
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [chainIdHex, rawProvider]);

  const chainIdNum = useMemo(() => {
    const hex = chainIdHex ?? fallbackChainIdHex;
    if (!hex) return null;
    try {
      return parseInt(String(hex), 16);
    } catch {
      return null;
    }
  }, [chainIdHex, fallbackChainIdHex]);

  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<ViewState>({
    chainId: null,
    foresightAddress: null,
    lpFeeStakingAddress: null,
    rewardTokenAddress: null,
    foresightDecimals: null,
    rewardDecimals: null,
    foresightWalletBalance: null,
    foresightStakedBalance: null,
    pendingReward: null,
  });

  const canTransact = Boolean(rawProvider && connectedAccount && isOwnProfile);

  const getReadProvider = useCallback(async () => {
    if (rawProvider) return new ethers.BrowserProvider(rawProvider);
    const url = getFallbackRpcUrl(chainIdNum ?? undefined);
    if (!url) return null;
    return new ethers.JsonRpcProvider(url);
  }, [rawProvider, chainIdNum]);

  const refresh = useCallback(async () => {
    if (!address) return;
    if (!chainIdNum) return;

    const addrs = resolveMakerRewardAddresses(chainIdNum);
    const foresightAddress = addrs.foresight || "";
    const lpFeeStakingAddress = addrs.lpFeeStaking || "";

    setLoading(true);
    try {
      const provider = await getReadProvider();
      if (!provider) return;

      if (!ethers.isAddress(foresightAddress) || !ethers.isAddress(lpFeeStakingAddress)) {
        setState((prev) => ({
          ...prev,
          chainId: chainIdNum,
          foresightAddress: ethers.isAddress(foresightAddress) ? foresightAddress : null,
          lpFeeStakingAddress: ethers.isAddress(lpFeeStakingAddress) ? lpFeeStakingAddress : null,
          rewardTokenAddress: null,
          foresightDecimals: null,
          rewardDecimals: null,
          foresightWalletBalance: null,
          foresightStakedBalance: null,
          pendingReward: null,
        }));
        return;
      }

      const foresight = new ethers.Contract(foresightAddress, erc20Abi, provider);
      const staking = new ethers.Contract(lpFeeStakingAddress, lpFeeStakingAbi, provider);

      const [foresightDecimalsRaw, rewardTokenAddress, walletBal, stakedBal, pending] =
        await Promise.all([
          foresight.decimals(),
          staking.rewardToken(),
          foresight.balanceOf(address),
          staking.balanceOf(address),
          staking.earned(address),
        ]);

      const rewardToken = new ethers.Contract(rewardTokenAddress, erc20Abi, provider);
      const rewardDecimalsRaw = await rewardToken.decimals();

      setState({
        chainId: chainIdNum,
        foresightAddress,
        lpFeeStakingAddress,
        rewardTokenAddress,
        foresightDecimals: Number(foresightDecimalsRaw),
        rewardDecimals: Number(rewardDecimalsRaw),
        foresightWalletBalance: walletBal as bigint,
        foresightStakedBalance: stakedBal as bigint,
        pendingReward: pending as bigint,
      });
    } catch (e: any) {
      toast.error(tProfile("makerEarnings.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [address, chainIdNum, getReadProvider, tProfile]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClaim = useCallback(async () => {
    if (!address) return;
    if (!rawProvider) {
      toast.error(tProfile("wallet.connectFirst"));
      return;
    }
    if (!chainIdNum) return;
    const lpFeeStakingAddress = resolveMakerRewardAddresses(chainIdNum).lpFeeStaking;
    if (!ethers.isAddress(lpFeeStakingAddress)) {
      toast.error(tProfile("makerEarnings.errors.notConfigured"));
      return;
    }

    try {
      const browserProvider = new ethers.BrowserProvider(rawProvider);
      const signer = await browserProvider.getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== address.toLowerCase()) {
        toast.error(tProfile("makerEarnings.errors.notYourWallet"));
        return;
      }
      const staking = new ethers.Contract(lpFeeStakingAddress, lpFeeStakingAbi, signer);
      const tx = await staking.getReward();
      await tx.wait();
      toast.success(tProfile("makerEarnings.actions.claimed"));
      await refresh();
    } catch {
      toast.error(tProfile("makerEarnings.errors.claimFailed"));
    }
  }, [address, rawProvider, chainIdNum, refresh, tProfile]);

  const explorerUrl = useMemo(() => {
    if (!state.lpFeeStakingAddress || !state.chainId) return null;
    if (state.chainId === 137)
      return `https://polygonscan.com/address/${state.lpFeeStakingAddress}`;
    if (state.chainId === 80002)
      return `https://amoy.polygonscan.com/address/${state.lpFeeStakingAddress}`;
    if (state.chainId === 11155111)
      return `https://sepolia.etherscan.io/address/${state.lpFeeStakingAddress}`;
    return null;
  }, [state.chainId, state.lpFeeStakingAddress]);

  if (!address) {
    return (
      <ProfileCard>
        <div className="text-sm text-gray-600">{tProfile("makerEarnings.empty.noAddress")}</div>
      </ProfileCard>
    );
  }

  if (!chainIdNum) {
    return (
      <ProfileCard>
        <div className="text-sm text-gray-600">{tProfile("makerEarnings.empty.connectWallet")}</div>
      </ProfileCard>
    );
  }

  const pendingText = formatAmount(state.pendingReward, state.rewardDecimals);
  const stakedText = formatAmount(state.foresightStakedBalance, state.foresightDecimals);
  const walletText = formatAmount(state.foresightWalletBalance, state.foresightDecimals);

  return (
    <div className="space-y-6">
      <ProfileCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-black text-gray-900">
                {tProfile("makerEarnings.title")}
              </div>
              <div className="text-xs text-gray-500">{tProfile("makerEarnings.subtitle")}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {tProfile("makerEarnings.actions.refresh")}
            </button>

            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 hover:border-gray-300 text-gray-700"
              >
                <ExternalLink className="w-4 h-4" />
                {tProfile("makerEarnings.actions.viewOnExplorer")}
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-xs font-black text-gray-400 uppercase tracking-wider">
              {tProfile("makerEarnings.cards.pendingReward")}
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600">{pendingText}</div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-xs font-black text-gray-400 uppercase tracking-wider">
              {tProfile("makerEarnings.cards.stakedForesight")}
            </div>
            <div className="mt-2 text-2xl font-black text-gray-900">{stakedText}</div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-xs font-black text-gray-400 uppercase tracking-wider">
              {tProfile("makerEarnings.cards.walletForesight")}
            </div>
            <div className="mt-2 text-2xl font-black text-gray-900">{walletText}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleClaim}
            disabled={!canTransact || loading || !state.lpFeeStakingAddress}
            className="inline-flex items-center justify-center px-4 py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {tProfile("makerEarnings.actions.claim")}
          </button>
          {!state.lpFeeStakingAddress && (
            <div className="text-xs text-gray-500">
              {tProfile("makerEarnings.hints.notConfigured")}
            </div>
          )}
          {state.lpFeeStakingAddress && !isOwnProfile && (
            <div className="text-xs text-gray-500">{tProfile("makerEarnings.hints.viewOnly")}</div>
          )}
        </div>
      </ProfileCard>
    </div>
  );
}
