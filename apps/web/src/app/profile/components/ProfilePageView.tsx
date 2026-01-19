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
  Shield,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import GradientPage from "@/components/ui/GradientPage";
import { buildDiceBearUrl } from "@/lib/dicebear";
import { toast, handleApiError } from "@/lib/toast";
import { formatAddress, normalizeAddress } from "@/lib/address";
import { useWallet } from "@/contexts/WalletContext";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "@/lib/i18n";
import type { Database } from "@/lib/database.types";
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
import DepositModal from "@/components/DepositModal";
import WithdrawModal from "@/components/WithdrawModal";
import {
  QueryKeys,
  fetcher,
  type UserFollowToggleResult,
  useUserFollowCounts,
  useUserFollowStatus,
} from "@/hooks/useQueries";

type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

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
  const tWallet = useTranslations("wallet");
  const queryClient = useQueryClient();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const prevUserIdRef = useRef<string | null>(userId);

  const accountNorm = useMemo(() => (account ? normalizeAddress(account) : ""), [account]);
  const myAccountNorm = useMemo(() => (myAccount ? normalizeAddress(myAccount) : ""), [myAccount]);

  const [emailChangeStep, setEmailChangeStep] = useState<
    "idle" | "old_sent" | "old_verified" | "new_sent"
  >("idle");
  const [emailChangeNewEmail, setEmailChangeNewEmail] = useState<string>("");
  const [emailChangeOldCode, setEmailChangeOldCode] = useState<string>("");
  const [emailChangeNewCode, setEmailChangeNewCode] = useState<string>("");
  const [emailChangeCodePreview, setEmailChangeCodePreview] = useState<string | null>(null);
  const [emailChangeResendLeft, setEmailChangeResendLeft] = useState(0);
  const emailChangeTimerRef = useRef<number | null>(null);

  const clearEmailChangeTimer = () => {
    if (emailChangeTimerRef.current !== null) {
      window.clearInterval(emailChangeTimerRef.current);
      emailChangeTimerRef.current = null;
    }
  };

  const startEmailChangeCountdown = (seconds: number) => {
    if (seconds <= 0) {
      setEmailChangeResendLeft(0);
      return;
    }
    clearEmailChangeTimer();
    setEmailChangeResendLeft(seconds);
    const id = window.setInterval(() => {
      setEmailChangeResendLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          emailChangeTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    emailChangeTimerRef.current = id;
  };

  useEffect(() => {
    return () => {
      clearEmailChangeTimer();
      setEmailChangeResendLeft(0);
    };
  }, []);

  const countsQuery = useUserFollowCounts(account || null);
  const followStatusQuery = useUserFollowStatus(account || null, myAccount || null);

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
  const currentEmailLower = String(currentEmail || "")
    .trim()
    .toLowerCase();
  const emailVerified = !!currentEmail;

  const requestEmailChangeOldOtpMutation = useMutation({
    mutationFn: async () => {
      const addr = String(accountNorm || "").toLowerCase();
      return fetcher<{ expiresInSec?: number; codePreview?: string }>("/api/email-otp/request", {
        method: "POST",
        body: JSON.stringify({ walletAddress: addr, email: currentEmailLower, mode: "change_old" }),
      });
    },
    onSuccess: (data) => {
      setEmailChangeStep("old_sent");
      setEmailChangeOldCode("");
      setEmailChangeNewCode("");
      if (data?.codePreview) {
        setEmailChangeOldCode(String(data.codePreview || ""));
        setEmailChangeCodePreview(String(data.codePreview || ""));
      } else {
        setEmailChangeCodePreview(null);
      }
      toast.success(tWalletModal("profile.sendOtpWithValidity"));
      startEmailChangeCountdown(60);
    },
    onError: (error: unknown) => {
      handleApiError(error, "walletModal.errors.otpSendFailed");
    },
  });

  const verifyEmailChangeOldOtpMutation = useMutation({
    mutationFn: async () => {
      const addr = String(accountNorm || "").toLowerCase();
      const code = String(emailChangeOldCode || "").trim();
      return fetcher<{ ok: boolean; stage?: string }>("/api/email-otp/verify", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: addr,
          email: currentEmailLower,
          code,
          mode: "change_old",
        }),
      });
    },
    onSuccess: () => {
      setEmailChangeStep("old_verified");
      setEmailChangeOldCode("");
      setEmailChangeNewCode("");
      setEmailChangeCodePreview(null);
      clearEmailChangeTimer();
      setEmailChangeResendLeft(0);
      toast.success(tCommon("success"));
    },
    onError: (error: unknown) => {
      handleApiError(error, "walletModal.errors.unknown");
    },
  });

  const requestEmailChangeNewOtpMutation = useMutation({
    mutationFn: async () => {
      const email = String(emailChangeNewEmail || "")
        .trim()
        .toLowerCase();
      const addr = String(accountNorm || "").toLowerCase();
      return fetcher<{ expiresInSec?: number; codePreview?: string }>("/api/email-otp/request", {
        method: "POST",
        body: JSON.stringify({ walletAddress: addr, email, mode: "change_new" }),
      });
    },
    onSuccess: (data) => {
      setEmailChangeStep("new_sent");
      setEmailChangeNewCode("");
      if (data?.codePreview) {
        setEmailChangeNewCode(String(data.codePreview || ""));
        setEmailChangeCodePreview(String(data.codePreview || ""));
      } else {
        setEmailChangeCodePreview(null);
      }
      toast.success(tWalletModal("profile.sendOtpWithValidity"));
      startEmailChangeCountdown(60);
    },
    onError: (error: unknown) => {
      handleApiError(error, "walletModal.errors.otpSendFailed");
    },
  });

  const verifyEmailChangeNewOtpMutation = useMutation({
    mutationFn: async () => {
      const email = String(emailChangeNewEmail || "")
        .trim()
        .toLowerCase();
      const addr = String(accountNorm || "").toLowerCase();
      const code = String(emailChangeNewCode || "").trim();
      return fetcher<{ ok: boolean }>("/api/email-otp/verify", {
        method: "POST",
        body: JSON.stringify({ walletAddress: addr, email, code, mode: "change_new" }),
      });
    },
    onSuccess: () => {
      toast.success(tCommon("success"));
      clearEmailChangeTimer();
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
    onError: (error: unknown) => {
      handleApiError(error, "walletModal.errors.unknown");
    },
  });

  const canRequestEmailChangeOld =
    isOwnProfile &&
    !!accountNorm &&
    !!userId &&
    emailVerified &&
    emailChangeResendLeft === 0 &&
    emailChangeStep === "idle" &&
    !requestEmailChangeOldOtpMutation.isPending &&
    !verifyEmailChangeOldOtpMutation.isPending &&
    !requestEmailChangeNewOtpMutation.isPending &&
    !verifyEmailChangeNewOtpMutation.isPending;

  const canVerifyEmailChangeOld =
    isOwnProfile &&
    !!accountNorm &&
    !!userId &&
    emailVerified &&
    emailChangeStep === "old_sent" &&
    /^\d{6}$/.test(String(emailChangeOldCode || "").trim()) &&
    !requestEmailChangeOldOtpMutation.isPending &&
    !verifyEmailChangeOldOtpMutation.isPending &&
    !requestEmailChangeNewOtpMutation.isPending &&
    !verifyEmailChangeNewOtpMutation.isPending;

  const canRequestEmailChangeNew =
    isOwnProfile &&
    !!accountNorm &&
    !!userId &&
    emailVerified &&
    emailChangeResendLeft === 0 &&
    emailChangeStep === "old_verified" &&
    /.+@.+\..+/.test(String(emailChangeNewEmail || "").trim()) &&
    !requestEmailChangeOldOtpMutation.isPending &&
    !verifyEmailChangeOldOtpMutation.isPending &&
    !requestEmailChangeNewOtpMutation.isPending &&
    !verifyEmailChangeNewOtpMutation.isPending;

  const canVerifyEmailChangeNew =
    isOwnProfile &&
    !!accountNorm &&
    !!userId &&
    emailVerified &&
    emailChangeStep === "new_sent" &&
    /^\d{6}$/.test(String(emailChangeNewCode || "").trim()) &&
    !requestEmailChangeOldOtpMutation.isPending &&
    !verifyEmailChangeOldOtpMutation.isPending &&
    !requestEmailChangeNewOtpMutation.isPending &&
    !verifyEmailChangeNewOtpMutation.isPending;

  const handleFollowToggle = async () => {
    if (!account) return;
    if (!myAccount) {
      toast.error(tProfile("wallet.connectFirst"));
      return;
    }
    await followMutation.mutateAsync();
  };

  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions", userId || "anon"],
    queryFn: async () =>
      fetcher<{ sessions: any[]; currentSessionId?: string }>("/api/auth/sessions", {
        method: "GET",
      }),
    enabled: isOwnProfile && !!userId && activeTab === "security",
    staleTime: 10_000,
  });

  const auditQuery = useQuery({
    queryKey: ["auth", "audit", userId || "anon"],
    queryFn: async () =>
      fetcher<{ events: any[] }>("/api/auth/audit", {
        method: "GET",
      }),
    enabled: isOwnProfile && !!userId && activeTab === "security",
    staleTime: 10_000,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) =>
      fetcher<{ ok: boolean }>("/api/auth/sessions", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
      toast.success(tCommon("success"));
      try {
        await auth?.refreshSession?.();
      } catch {}
    },
    onError: (error: unknown) => {
      handleApiError(error, "walletModal.errors.unknown");
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () =>
      fetcher<{ ok: boolean }>("/api/auth/sessions", {
        method: "DELETE",
      }),
    onSuccess: async () => {
      toast.success(tCommon("success"));
      try {
        await auth?.refreshSession?.();
      } catch {}
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
    onError: (error: unknown) => {
      handleApiError(error, "walletModal.errors.unknown");
    },
  });

  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState<string>("");

  const deleteAccountMutation = useMutation({
    mutationFn: async () =>
      fetcher<{ ok: boolean; address?: string }>("/api/auth/delete-account", {
        method: "POST",
        body: JSON.stringify({ confirm: deleteAccountConfirm.trim() }),
      }),
    onSuccess: async () => {
      toast.success(tCommon("success"));
      setDeleteAccountConfirm("");
      try {
        await auth?.signOut?.();
      } catch {}
      try {
        await disconnect?.();
      } catch {}
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    },
    onError: (error: unknown) => {
      handleApiError(error, "walletModal.errors.unknown");
    },
  });

  const canDeleteAccount =
    isOwnProfile &&
    !!userId &&
    String(deleteAccountConfirm || "").trim() === "DELETE" &&
    !deleteAccountMutation.isPending;

  const formatTs = (raw: unknown) => {
    const s = typeof raw === "string" ? raw : "";
    if (!s) return "";
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleString();
  };
  return (
    <GradientPage className="h-[100svh] supports-[height:100dvh]:h-[100dvh] !overflow-y-auto !overflow-x-hidden mobile-scroll custom-scrollbar pt-20 pb-nav lg:h-screen lg:!overflow-hidden lg:pt-0 lg:pb-0">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 lg:h-full lg:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:h-[calc(100vh-5rem)] lg:overflow-hidden">
          <div className="lg:col-span-1 lg:h-full">
            <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-2xl shadow-purple-500/10 p-6 lg:h-full lg:flex lg:flex-col group">
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
                <div className="flex items-center justify-center gap-2 mb-6">
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
                    className="flex items-center gap-2 bg-white/80 border border-purple-100 px-4 py-1.5 rounded-full text-xs font-bold font-mono shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-purple-200 hover:shadow-md"
                  >
                    <Wallet className="w-3.5 h-3.5 text-purple-600" />
                    <span className={account ? "text-purple-600" : "text-gray-400"}>
                      {account ? formatAddress(account) : tProfile("username.walletDisconnected")}
                    </span>
                  </button>

                  {isOwnProfile && account && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDepositOpen(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white border border-transparent px-4 py-1.5 rounded-full text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                        <span>{tWallet("deposit")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawOpen(true)}
                        className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm hover:shadow-md hover:border-purple-300 hover:text-purple-600 transition-all active:scale-95"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        <span>提现</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Email verification section removed as per request */}

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

                {/* Stats cards removed as per request to improve mobile visibility */}

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
                    {activeTab === "security" && isOwnProfile && (
                      <div className="space-y-6 lg:h-full lg:overflow-auto pb-10">
                        <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-2xl shadow-purple-500/10 p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Shield className="w-5 h-5 text-purple-600" />
                            <div className="text-lg font-black text-gray-900">
                              {tProfile("security.emailChangeTitle")}
                            </div>
                          </div>

                          {!emailVerified ? (
                            <div className="text-sm font-semibold text-gray-600">
                              {tProfile("security.emailChangeNeedVerified")}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="text-xs text-gray-600 font-semibold break-all">
                                {tProfile("security.currentEmail")}: {currentEmailLower || "-"}
                              </div>

                              {emailChangeStep === "idle" && (
                                <button
                                  type="button"
                                  disabled={!canRequestEmailChangeOld}
                                  onClick={async () => {
                                    await requestEmailChangeOldOtpMutation.mutateAsync();
                                  }}
                                  className="h-11 px-4 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 hover:from-purple-400 hover:to-pink-400 hover:text-white"
                                >
                                  {requestEmailChangeOldOtpMutation.isPending
                                    ? tCommon("loading")
                                    : `${tProfile("security.emailChangeVerifyOld")}${emailChangeResendLeft > 0 ? ` (${emailChangeResendLeft}s)` : ""}`}
                                </button>
                              )}

                              {emailChangeStep === "old_sent" && (
                                <div className="space-y-2">
                                  <input
                                    value={emailChangeOldCode}
                                    onChange={(e) =>
                                      setEmailChangeOldCode(
                                        e.target.value.replace(/[^\d]/g, "").slice(0, 6)
                                      )
                                    }
                                    placeholder={tProfile("security.otpPlaceholder")}
                                    inputMode="numeric"
                                    className="w-full h-11 px-3 rounded-xl border border-purple-100 bg-white/80 text-sm font-semibold text-gray-900 outline-none focus:border-purple-300"
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={!canVerifyEmailChangeOld}
                                      onClick={async () => {
                                        await verifyEmailChangeOldOtpMutation.mutateAsync();
                                      }}
                                      className="h-11 px-4 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-white/90 border border-purple-100 text-purple-700 hover:border-purple-200 hover:bg-white"
                                    >
                                      {verifyEmailChangeOldOtpMutation.isPending
                                        ? tCommon("loading")
                                        : tProfile("security.emailChangeConfirmOld")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEmailChangeStep("idle");
                                        setEmailChangeOldCode("");
                                        setEmailChangeNewCode("");
                                        setEmailChangeCodePreview(null);
                                        clearEmailChangeTimer();
                                        setEmailChangeResendLeft(0);
                                      }}
                                      className="h-11 px-4 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 bg-white/80 border border-purple-100 text-gray-700 hover:border-purple-200 hover:bg-white"
                                    >
                                      {tCommon("cancel")}
                                    </button>
                                  </div>
                                  {!!emailChangeCodePreview && (
                                    <div className="text-xs text-gray-600 font-semibold">
                                      {tWalletModal("devCodePreviewPrefix")}{" "}
                                      {emailChangeCodePreview}
                                    </div>
                                  )}
                                </div>
                              )}

                              {emailChangeStep === "old_verified" && (
                                <div className="space-y-2">
                                  <input
                                    value={emailChangeNewEmail}
                                    onChange={(e) => {
                                      setEmailChangeNewEmail(e.target.value);
                                      setEmailChangeNewCode("");
                                      setEmailChangeCodePreview(null);
                                    }}
                                    placeholder={tProfile("security.newEmailPlaceholder")}
                                    className="w-full h-11 px-3 rounded-xl border border-purple-100 bg-white/80 text-sm font-semibold text-gray-900 outline-none focus:border-purple-300"
                                  />
                                  <button
                                    type="button"
                                    disabled={!canRequestEmailChangeNew}
                                    onClick={async () => {
                                      await requestEmailChangeNewOtpMutation.mutateAsync();
                                    }}
                                    className="h-11 px-4 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 hover:from-purple-400 hover:to-pink-400 hover:text-white"
                                  >
                                    {requestEmailChangeNewOtpMutation.isPending
                                      ? tCommon("loading")
                                      : `${tProfile("security.emailChangeSendNew")}${emailChangeResendLeft > 0 ? ` (${emailChangeResendLeft}s)` : ""}`}
                                  </button>
                                </div>
                              )}

                              {emailChangeStep === "new_sent" && (
                                <div className="space-y-2">
                                  <div className="text-xs text-gray-600 font-semibold break-all">
                                    {tProfile("security.newEmail")}:{" "}
                                    {String(emailChangeNewEmail || "")
                                      .trim()
                                      .toLowerCase() || "-"}
                                  </div>
                                  <input
                                    value={emailChangeNewCode}
                                    onChange={(e) =>
                                      setEmailChangeNewCode(
                                        e.target.value.replace(/[^\d]/g, "").slice(0, 6)
                                      )
                                    }
                                    placeholder={tProfile("security.otpPlaceholder")}
                                    inputMode="numeric"
                                    className="w-full h-11 px-3 rounded-xl border border-purple-100 bg-white/80 text-sm font-semibold text-gray-900 outline-none focus:border-purple-300"
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={!canVerifyEmailChangeNew}
                                      onClick={async () => {
                                        await verifyEmailChangeNewOtpMutation.mutateAsync();
                                      }}
                                      className="h-11 px-4 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-white/90 border border-purple-100 text-purple-700 hover:border-purple-200 hover:bg-white"
                                    >
                                      {verifyEmailChangeNewOtpMutation.isPending
                                        ? tCommon("loading")
                                        : tProfile("security.emailChangeConfirmNew")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEmailChangeStep("idle");
                                        setEmailChangeNewEmail("");
                                        setEmailChangeOldCode("");
                                        setEmailChangeNewCode("");
                                        setEmailChangeCodePreview(null);
                                        clearEmailChangeTimer();
                                        setEmailChangeResendLeft(0);
                                      }}
                                      className="h-11 px-4 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 bg-white/80 border border-purple-100 text-gray-700 hover:border-purple-200 hover:bg-white"
                                    >
                                      {tCommon("cancel")}
                                    </button>
                                  </div>
                                  {!!emailChangeCodePreview && (
                                    <div className="text-xs text-gray-600 font-semibold">
                                      {tWalletModal("devCodePreviewPrefix")}{" "}
                                      {emailChangeCodePreview}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-2xl shadow-purple-500/10 p-6">
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                              <Shield className="w-5 h-5 text-purple-600" />
                              <div className="text-lg font-black text-gray-900">
                                {tProfile("security.sessionsTitle")}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={revokeAllSessionsMutation.isPending}
                              onClick={async () => {
                                await revokeAllSessionsMutation.mutateAsync();
                              }}
                              className="h-10 px-4 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-white/90 border border-purple-100 text-purple-700 hover:border-purple-200 hover:bg-white"
                            >
                              {revokeAllSessionsMutation.isPending
                                ? tCommon("loading")
                                : tProfile("security.revokeAll")}
                            </button>
                          </div>

                          {sessionsQuery.isFetching ? (
                            <div className="text-sm font-semibold text-gray-600">
                              {tCommon("loading")}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {(sessionsQuery.data?.sessions || []).length === 0 ? (
                                <div className="text-sm font-semibold text-gray-600">
                                  {tProfile("security.noSessions")}
                                </div>
                              ) : (
                                (sessionsQuery.data?.sessions || []).map((s: any) => {
                                  const sid = String(s?.sessionId || "");
                                  const currentSessionId = String(
                                    sessionsQuery.data?.currentSessionId || ""
                                  );
                                  const isCurrent =
                                    !!sid && !!currentSessionId && sid === currentSessionId;
                                  return (
                                    <div
                                      key={sid || Math.random()}
                                      className="bg-white/80 border border-purple-100 rounded-2xl p-4 flex items-start justify-between gap-3"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="text-sm font-black text-gray-900">
                                            {s?.authMethod
                                              ? String(s.authMethod)
                                              : tProfile("security.unknownMethod")}
                                          </div>
                                          {isCurrent && (
                                            <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                                              {tProfile("security.currentSession")}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-xs text-gray-600 font-semibold break-all">
                                          {tProfile("security.createdAt")}:{" "}
                                          {formatTs(s?.createdAt) || "-"}
                                        </div>
                                        <div className="text-xs text-gray-600 font-semibold break-all">
                                          {tProfile("security.lastSeenAt")}:{" "}
                                          {formatTs(s?.lastSeenAt) || "-"}
                                        </div>
                                        <div className="text-xs text-gray-600 font-semibold break-all">
                                          {tProfile("security.ip")}:{" "}
                                          {s?.ipPrefix ? String(s.ipPrefix) : "-"}
                                        </div>
                                        <div className="text-xs text-gray-600 font-semibold break-all">
                                          {tProfile("security.device")}:{" "}
                                          {s?.userAgent ? String(s.userAgent) : "-"}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={revokeSessionMutation.isPending || isCurrent}
                                        onClick={async () => {
                                          if (!sid) return;
                                          await revokeSessionMutation.mutateAsync(sid);
                                        }}
                                        className="h-10 px-4 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 hover:from-purple-400 hover:to-pink-400 hover:text-white"
                                      >
                                        {tProfile("security.revoke")}
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-2xl shadow-purple-500/10 p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Shield className="w-5 h-5 text-purple-600" />
                            <div className="text-lg font-black text-gray-900">
                              {tProfile("security.auditTitle")}
                            </div>
                          </div>
                          {auditQuery.isFetching ? (
                            <div className="text-sm font-semibold text-gray-600">
                              {tCommon("loading")}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {(auditQuery.data?.events || []).length === 0 ? (
                                <div className="text-sm font-semibold text-gray-600">
                                  {tProfile("security.noAudit")}
                                </div>
                              ) : (
                                (auditQuery.data?.events || []).map((e: any) => (
                                  <div
                                    key={String(e?.id || Math.random())}
                                    className="bg-white/80 border border-purple-100 rounded-2xl p-4"
                                  >
                                    <div className="text-sm font-black text-gray-900">
                                      {e?.method
                                        ? String(e.method)
                                        : tProfile("security.unknownMethod")}
                                    </div>
                                    <div className="text-xs text-gray-600 font-semibold">
                                      {formatTs(e?.createdAt) || "-"}
                                    </div>
                                    <div className="text-xs text-gray-600 font-semibold break-all">
                                      {tProfile("security.ip")}:{" "}
                                      {e?.ipPrefix ? String(e.ipPrefix) : "-"}
                                    </div>
                                    <div className="text-xs text-gray-600 font-semibold break-all">
                                      {tProfile("security.device")}:{" "}
                                      {e?.userAgent ? String(e.userAgent) : "-"}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-2xl shadow-purple-500/10 p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <UserMinus className="w-5 h-5 text-red-600" />
                            <div className="text-lg font-black text-gray-900">
                              {tProfile("security.deleteAccountTitle")}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-600 mb-4">
                            {tProfile("security.deleteAccountDescription")}
                          </div>
                          <div className="space-y-3">
                            <div className="text-xs text-gray-600 font-semibold">
                              {tProfile("security.deleteAccountConfirmHint")}
                            </div>
                            <input
                              value={deleteAccountConfirm}
                              onChange={(e) => setDeleteAccountConfirm(e.target.value)}
                              placeholder="DELETE"
                              autoCapitalize="off"
                              autoCorrect="off"
                              spellCheck={false}
                              className="w-full h-11 px-3 rounded-xl border border-red-200 bg-white/80 text-sm font-semibold text-gray-900 outline-none focus:border-red-300"
                            />
                            <button
                              type="button"
                              disabled={!canDeleteAccount}
                              onClick={async () => {
                                await deleteAccountMutation.mutateAsync();
                              }}
                              className="h-11 px-4 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-red-200 to-rose-300 text-red-800 border border-red-200 hover:from-red-500 hover:to-rose-500 hover:text-white"
                            >
                              {deleteAccountMutation.isPending
                                ? tCommon("loading")
                                : tProfile("security.deleteAccountAction")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onRequireLogin={() => setWalletModalOpen(true)}
      />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </GradientPage>
  );
}
