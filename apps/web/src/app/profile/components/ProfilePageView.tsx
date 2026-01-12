"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  LogOut,
  Wallet,
  UserPlus,
  UserMinus,
  Loader2,
  Target,
  Users,
  Zap,
  Heart,
} from "lucide-react";
import GradientPage from "@/components/ui/GradientPage";
import { buildDiceBearUrl } from "@/lib/dicebear";
import { toast, handleApiError } from "@/lib/toast";
import { formatAddress, normalizeAddress } from "@/lib/address";
import { useWallet } from "@/contexts/WalletContext";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "@/lib/i18n";
import type { UserProfile } from "@/lib/supabase";
import type {
  PortfolioStats,
  ProfileHistoryItem,
  ProfilePosition,
  TabConfig,
  TabType,
} from "../types";
import { SidebarStatCard } from "./ProfileUI";
import { PredictionsTab } from "./PredictionsTab";
import { HistoryTab } from "./HistoryTab";
import { FollowingTab } from "./FollowingTab";
import { FollowersTab } from "./FollowersTab";
import { MakerEarningsTab } from "./MakerEarningsTab";
import EmptyState from "@/components/EmptyState";
import WalletModal from "@/components/WalletModal";
import {
  QueryKeys,
  fetcher,
  type UserFollowToggleResult,
  useUserFollowCounts,
  useUserFollowStatus,
} from "@/hooks/useQueries";

export type ProfilePageViewProps = {
  account: string | null;
  username: string;
  profileInfo?: UserProfile | null;
  tProfile: (key: string) => string;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  tabs: TabConfig[];
  historyCount: number;
  positionsCount: number;
  portfolioStats: PortfolioStats | null;
  positions: ProfilePosition[];
  historyLoading: boolean;
  portfolioLoading: boolean;
  portfolioError: boolean;
  disconnect: () => void | Promise<void>;
  history: ProfileHistoryItem[];
  isOwnProfile?: boolean;
};

export function ProfilePageView({
  account,
  username,
  profileInfo,
  tProfile,
  activeTab,
  setActiveTab,
  tabs,
  historyCount,
  positionsCount,
  portfolioStats,
  positions,
  historyLoading,
  portfolioLoading,
  portfolioError,
  disconnect,
  history,
  isOwnProfile = true,
}: ProfilePageViewProps) {
  const { account: myAccount } = useWallet();
  const auth = useAuthOptional();
  const userId = auth?.user?.id ?? null;
  const tCommon = useTranslations("common");
  const tWalletModal = useTranslations("walletModal");
  const queryClient = useQueryClient();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const prevUserIdRef = useRef<string | null>(userId);

  const accountNorm = useMemo(() => (account ? normalizeAddress(account) : ""), [account]);
  const myAccountNorm = useMemo(() => (myAccount ? normalizeAddress(myAccount) : ""), [myAccount]);

  const [emailInput, setEmailInput] = useState<string>("");
  const [otpInput, setOtpInput] = useState<string>("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [codePreview, setCodePreview] = useState<string | null>(null);

  useEffect(() => {
    const existing = String(profileInfo?.email || "")
      .trim()
      .toLowerCase();
    if (existing) {
      setEmailInput(existing);
      setOtpRequested(false);
      setOtpInput("");
      setCodePreview(null);
      return;
    }
    setOtpRequested(false);
    setOtpInput("");
    setCodePreview(null);
  }, [profileInfo?.email]);

  const countsQuery = useUserFollowCounts(account || null);
  const followStatusQuery = useUserFollowStatus(account || null, myAccount || null);

  const requestEmailOtpMutation = useMutation({
    mutationFn: async () => {
      const email = String(emailInput || "")
        .trim()
        .toLowerCase();
      const addr = String(accountNorm || "").toLowerCase();
      return fetcher<{ expiresInSec?: number; codePreview?: string }>("/api/email-otp/request", {
        method: "POST",
        body: JSON.stringify({ walletAddress: addr, email }),
      });
    },
    onSuccess: (data) => {
      setOtpRequested(true);
      setOtpInput("");
      if (data?.codePreview) {
        setOtpInput(String(data.codePreview || ""));
        setCodePreview(String(data.codePreview || ""));
      } else {
        setCodePreview(null);
      }
      toast.success(tWalletModal("profile.sendOtpWithValidity"));
    },
    onError: (error: unknown) => {
      handleApiError(error, "walletModal.errors.otpSendFailed");
    },
  });

  const verifyEmailOtpMutation = useMutation({
    mutationFn: async () => {
      const email = String(emailInput || "")
        .trim()
        .toLowerCase();
      const code = String(otpInput || "").trim();
      const addr = String(accountNorm || "").toLowerCase();
      return fetcher<{ ok: boolean }>("/api/email-otp/verify", {
        method: "POST",
        body: JSON.stringify({ walletAddress: addr, email, code }),
      });
    },
    onSuccess: async () => {
      setOtpRequested(false);
      setOtpInput("");
      setCodePreview(null);
      toast.success(tCommon("success"));
      await queryClient.invalidateQueries({ queryKey: QueryKeys.userProfile(accountNorm) });
    },
    onError: (error: unknown) => {
      handleApiError(error, "walletModal.errors.otpVerifyFailed");
    },
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      return fetcher<UserFollowToggleResult>("/api/user-follows/user", {
        method: "POST",
        body: JSON.stringify({ targetAddress: accountNorm || account }),
      });
    },
    onMutate: async () => {
      if (!account || !myAccount || isOwnProfile) return;

      await Promise.all([
        queryClient.cancelQueries({
          queryKey: QueryKeys.userFollowStatus(accountNorm, myAccountNorm),
        }),
        queryClient.cancelQueries({ queryKey: QueryKeys.userFollowCounts(accountNorm) }),
      ]);

      const prevFollowed = queryClient.getQueryData<boolean>([
        ...QueryKeys.userFollowStatus(accountNorm, myAccountNorm),
      ]);
      const prevCounts = queryClient.getQueryData<{
        followersCount: number;
        followingCount: number;
      }>(QueryKeys.userFollowCounts(accountNorm));

      const nextFollowed = !(prevFollowed ?? false);
      queryClient.setQueryData(
        QueryKeys.userFollowStatus(accountNorm, myAccountNorm),
        nextFollowed
      );

      if (prevCounts) {
        queryClient.setQueryData(QueryKeys.userFollowCounts(accountNorm), {
          ...prevCounts,
          followersCount: Math.max(0, prevCounts.followersCount + (nextFollowed ? 1 : -1)),
        });
      }

      return { prevFollowed, prevCounts };
    },
    onError: (_err, _vars, ctx) => {
      if (!account || !myAccount || !ctx) return;
      queryClient.setQueryData(
        QueryKeys.userFollowStatus(accountNorm, myAccountNorm),
        ctx.prevFollowed
      );
      queryClient.setQueryData(QueryKeys.userFollowCounts(accountNorm), ctx.prevCounts);
      toast.error(tProfile("follow.failed"));
    },
    onSuccess: (data) => {
      if (!data) return;
      toast.success(
        data.followed ? tProfile("follow.followSuccess") : tProfile("follow.unfollowSuccess")
      );
    },
    onSettled: async () => {
      if (!account) return;
      await queryClient.invalidateQueries({
        queryKey: QueryKeys.userFollowCounts(accountNorm),
      });
      if (accountNorm) {
        await queryClient.invalidateQueries({
          queryKey: ["profile", "followers", "users", accountNorm],
        });
      }
      if (myAccountNorm) {
        await queryClient.invalidateQueries({
          queryKey: ["profile", "following", "users", myAccountNorm],
        });
      }
      if (myAccount && !isOwnProfile) {
        await queryClient.invalidateQueries({
          queryKey: QueryKeys.userFollowStatus(accountNorm, myAccountNorm),
        });
      }
    },
  });

  useEffect(() => {
    const prev = prevUserIdRef.current;
    const curr = userId;
    if (walletModalOpen && !prev && curr) {
      setWalletModalOpen(false);
    }
    prevUserIdRef.current = curr;
  }, [userId, walletModalOpen]);

  const followersCount = countsQuery.data?.followersCount ?? 0;
  const followingCount = countsQuery.data?.followingCount ?? 0;
  const isFollowed = followStatusQuery.data ?? false;
  const isFollowLoading = followMutation.isPending || followStatusQuery.isFetching;

  const currentEmail = String(profileInfo?.email || "").trim();
  const emailVerified = !!currentEmail;
  const canRequestOtp =
    isOwnProfile &&
    !!accountNorm &&
    !!userId &&
    /.+@.+\..+/.test(String(emailInput || "").trim()) &&
    !requestEmailOtpMutation.isPending &&
    !verifyEmailOtpMutation.isPending;
  const canVerifyOtp =
    isOwnProfile &&
    !!accountNorm &&
    !!userId &&
    otpRequested &&
    /^\d{6}$/.test(String(otpInput || "").trim()) &&
    !requestEmailOtpMutation.isPending &&
    !verifyEmailOtpMutation.isPending;

  const handleFollowToggle = async () => {
    if (!account) return;
    if (!myAccount) {
      toast.error(tProfile("wallet.connectFirst"));
      return;
    }
    await followMutation.mutateAsync();
  };
  return (
    <GradientPage className="lg:h-screen lg:overflow-hidden pt-20 pb-4 lg:pt-0 lg:pb-0">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 lg:h-full lg:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:h-[calc(100vh-5rem)] lg:overflow-hidden">
          <div className="lg:col-span-1 lg:h-full">
            <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-2xl shadow-purple-500/10 p-6 lg:h-full lg:flex lg:flex-col lg:sticky lg:top-24 overflow-hidden group">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-300/20 rounded-full blur-3xl group-hover:bg-purple-300/30 transition-colors duration-700" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-pink-300/20 rounded-full blur-3xl group-hover:bg-pink-300/30 transition-colors duration-700" />

              <div className="flex flex-col items-center text-center mb-8 relative z-10 lg:shrink-0">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 p-[3px] mb-4 shadow-lg shadow-fuchsia-500/30 hover:scale-105 transition-transform duration-300">
                  <div className="w-full h-full rounded-full bg-white p-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={buildDiceBearUrl(account || "User")}
                      alt={tProfile("avatarAlt")}
                      className="w-full h-full object-cover rounded-full bg-gray-50"
                    />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-1 bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600">
                  {username}
                </h2>
                <button
                  type="button"
                  disabled={!account}
                  onClick={async () => {
                    if (!account) return;
                    try {
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(account);
                      } else {
                        const textarea = document.createElement("textarea");
                        textarea.value = account;
                        textarea.style.position = "fixed";
                        textarea.style.opacity = "0";
                        document.body.appendChild(textarea);
                        textarea.focus();
                        textarea.select();
                        try {
                          document.execCommand("copy");
                        } finally {
                          document.body.removeChild(textarea);
                        }
                      }
                      toast.success(tProfile("wallet.addressCopied"));
                    } catch {
                      toast.error(tProfile("wallet.copyAddress"));
                    }
                  }}
                  className="flex items-center gap-2 bg-white/80 border border-purple-100 px-4 py-1.5 rounded-full text-xs font-bold font-mono mb-6 shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-purple-200 hover:shadow-md"
                >
                  <Wallet className="w-3.5 h-3.5 text-purple-600" />
                  <span className={account ? "text-purple-600" : "text-gray-400"}>
                    {account ? formatAddress(account) : tProfile("username.walletDisconnected")}
                  </span>
                </button>

                {isOwnProfile && account && (
                  <div className="w-full mb-6 bg-white/70 border border-purple-100 rounded-2xl p-4 text-left">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-sm font-black text-gray-900">
                        {tWalletModal("profile.verifyEmail")}
                      </div>
                      {emailVerified && (
                        <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                          {tWalletModal("profile.verifiedTag")}
                        </div>
                      )}
                    </div>

                    {emailVerified && (
                      <div className="text-xs text-gray-700 font-mono break-all mb-3">
                        {currentEmail}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <input
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          setOtpRequested(false);
                          setOtpInput("");
                          setCodePreview(null);
                        }}
                        placeholder="name@example.com"
                        className="w-full h-11 px-3 rounded-xl border border-purple-100 bg-white/80 text-sm font-semibold text-gray-900 outline-none focus:border-purple-300"
                      />

                      <button
                        type="button"
                        disabled={!canRequestOtp}
                        onClick={async () => {
                          if (!userId) {
                            setWalletModalOpen(true);
                            return;
                          }
                          if (!/.+@.+\..+/.test(String(emailInput || "").trim())) {
                            toast.error(tWalletModal("profile.emailInvalid"));
                            return;
                          }
                          await requestEmailOtpMutation.mutateAsync();
                        }}
                        className="w-full h-11 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 hover:from-purple-400 hover:to-pink-400 hover:text-white"
                      >
                        {requestEmailOtpMutation.isPending ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {tCommon("loading")}
                          </span>
                        ) : (
                          tWalletModal("profile.sendOtpWithValidity")
                        )}
                      </button>

                      {otpRequested && (
                        <>
                          <input
                            value={otpInput}
                            onChange={(e) =>
                              setOtpInput(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
                            }
                            placeholder="123456"
                            inputMode="numeric"
                            className="w-full h-11 px-3 rounded-xl border border-purple-100 bg-white/80 text-sm font-semibold text-gray-900 outline-none focus:border-purple-300"
                          />

                          <button
                            type="button"
                            disabled={!canVerifyOtp}
                            onClick={async () => {
                              if (!userId) {
                                setWalletModalOpen(true);
                                return;
                              }
                              await verifyEmailOtpMutation.mutateAsync();
                            }}
                            className="w-full h-11 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-white/90 border border-purple-100 text-purple-700 hover:border-purple-200 hover:bg-white"
                          >
                            {verifyEmailOtpMutation.isPending ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {tCommon("loading")}
                              </span>
                            ) : (
                              tWalletModal("profile.verifyEmail")
                            )}
                          </button>

                          {!!codePreview && (
                            <div className="text-xs text-gray-600 font-semibold">
                              {tWalletModal("devCodePreviewPrefix")} {codePreview}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 font-medium">
                            {tWalletModal("profile.otpTip")}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {isOwnProfile && !account && (
                  <button
                    type="button"
                    onClick={() => setWalletModalOpen(true)}
                    className="w-full py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 mb-2 bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 hover:from-purple-400 hover:to-pink-400 hover:text-white"
                  >
                    <Wallet className="w-4 h-4" />
                    {tProfile("disconnected.actionConnect")}
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2.5 w-full mb-8">
                  <div className="cursor-pointer" onClick={() => setActiveTab("predictions")}>
                    <SidebarStatCard
                      value={positionsCount}
                      label={tProfile("sidebar.stats.predictions")}
                      icon={Target}
                      color="violet"
                    />
                  </div>
                  <div className="cursor-pointer" onClick={() => setActiveTab("following")}>
                    <SidebarStatCard
                      value={followingCount}
                      label={tProfile("sidebar.tabs.following")}
                      icon={Heart}
                      color="amber"
                    />
                  </div>
                  <div className="cursor-pointer" onClick={() => setActiveTab("followers")}>
                    <SidebarStatCard
                      value={followersCount}
                      label={tProfile("sidebar.stats.followers")}
                      icon={Users}
                      color="emerald"
                    />
                  </div>
                  <div className="cursor-pointer" onClick={() => setActiveTab("history")}>
                    <SidebarStatCard
                      value={historyCount}
                      label={tProfile("sidebar.stats.history")}
                      icon={Zap}
                      color="cyan"
                    />
                  </div>
                </div>

                {!isOwnProfile && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 mb-2 ${
                      isFollowed
                        ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
                        : "bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 hover:from-purple-400 hover:to-pink-400 hover:text-white"
                    }`}
                  >
                    {isFollowLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowed ? (
                      <UserMinus className="w-4 h-4" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    {isFollowLoading
                      ? tProfile("follow.loading")
                      : isFollowed
                        ? tProfile("follow.unfollowButton")
                        : tProfile("follow.followTraderButton")}
                  </button>
                )}
              </div>

              <nav className="space-y-2 relative z-10 lg:flex-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm group/btn ${
                      activeTab === tab.id
                        ? "bg-gray-900 text-white shadow-xl shadow-gray-900/20 scale-[1.02]"
                        : "text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-md hover:scale-[1.02]"
                    }`}
                  >
                    <tab.icon
                      className={`w-5 h-5 transition-colors ${
                        activeTab === tab.id
                          ? "text-fuchsia-400"
                          : "text-gray-400 group-hover/btn:text-fuchsia-500"
                      }`}
                    />
                    {tab.label}
                    {activeTab === tab.id && (
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    )}
                  </button>
                ))}
                {isOwnProfile && (
                  <>
                    {account && (
                      <button
                        onClick={disconnect}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all font-bold text-sm"
                      >
                        <LogOut className="w-5 h-5" />
                        {tProfile("sidebar.disconnect")}
                      </button>
                    )}
                  </>
                )}
              </nav>
            </div>
          </div>

          <div className="lg:col-span-3 lg:h-full lg:overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                className="lg:h-full"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {isOwnProfile && !account ? (
                  <div className="lg:h-full flex items-center justify-center">
                    <EmptyState
                      icon={Wallet}
                      title={tProfile("disconnected.title")}
                      description={tProfile("disconnected.description")}
                      action={{
                        label: tProfile("disconnected.actionConnect"),
                        onClick: () => setWalletModalOpen(true),
                      }}
                      className="relative"
                    />
                  </div>
                ) : (
                  <>
                    {activeTab === "predictions" && (
                      <PredictionsTab
                        address={account}
                        positions={positions}
                        portfolioStats={portfolioStats}
                        loading={portfolioLoading}
                        error={portfolioError}
                      />
                    )}
                    {activeTab === "history" && (
                      <HistoryTab history={history} loading={historyLoading} />
                    )}
                    {activeTab === "following" && <FollowingTab address={account} />}
                    {activeTab === "followers" && account && <FollowersTab address={account} />}
                    {activeTab === "makerEarnings" && (
                      <MakerEarningsTab address={account} isOwnProfile={isOwnProfile} />
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </GradientPage>
  );
}
