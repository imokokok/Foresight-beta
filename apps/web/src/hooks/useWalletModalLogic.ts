"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useTranslations } from "@/lib/i18n";
import {
  fetcher,
  type EmailOtpRequestResult,
  type EmailOtpVerifyResult,
  type UserProfileInfoResponse,
} from "@/hooks/useQueries";
import { handleApiError } from "@/lib/toast";
import { logClientErrorToApi } from "@/lib/errorReporting";

export type WalletStep =
  | "select"
  | "connecting"
  | "permissions"
  | "sign"
  | "multisig"
  | "profile"
  | "completed";

export interface UseWalletModalOptions {
  isOpen: boolean;
  onClose: () => void;
}

export function useWalletModalLogic({ isOpen, onClose }: UseWalletModalOptions) {
  const router = useRouter();
  const {
    connectWalletWithResult,
    availableWallets,
    isConnecting,
    siweLogin,
    requestWalletPermissions,
    multisigSign,
    account,
    normalizedAccount,
  } = useWallet();
  const auth = useAuthOptional();
  const userProfile = useUserProfileOptional();
  const tGlobal = useTranslations();
  const tWalletModal = useTranslations("walletModal");
  const tLogin = useTranslations("login");
  const user = auth?.user ?? null;
  const authError = auth?.error ?? null;
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otp, setOtp] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [siweLoading, setSiweLoading] = useState(false);
  const [permLoading, setPermLoading] = useState(false);
  const [multiLoading, setMultiLoading] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [codePreview, setCodePreview] = useState<string | null>(null);
  const resendTimerRef = React.useRef<number | null>(null);

  // New states for signup flow
  const [requireUsername, setRequireUsername] = useState(false);
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [installPromptOpen, setInstallPromptOpen] = useState(false);
  const [installWalletName, setInstallWalletName] = useState<string>("");
  const [installUrl, setInstallUrl] = useState<string>("");
  const [walletStep, setWalletStep] = useState<WalletStep>("select");
  const [mounted, setMounted] = useState(false);
  const verifiedEmailRef = React.useRef<string | null>(null);
  const [isNewUserFlow, setIsNewUserFlow] = useState(false);

  const clearResendTimer = React.useCallback(() => {
    if (resendTimerRef.current !== null) {
      window.clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  }, []);

  const startResendCountdown = React.useCallback(
    (seconds: number) => {
      if (seconds <= 0) {
        setResendLeft(0);
        return;
      }
      clearResendTimer();
      setResendLeft(seconds);
      const id = window.setInterval(() => {
        setResendLeft((prev) => {
          if (prev <= 1) {
            window.clearInterval(id);
            resendTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      resendTimerRef.current = id;
    },
    [clearResendTimer]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      clearResendTimer();
      return;
    }
    if (!user) {
      setSelectedWallet(null);
      setEmail("");
      setOtpRequested(false);
      setOtp("");
      setEmailLoading(false);
      setSiweLoading(false);
      setPermLoading(false);
      setMultiLoading(false);
      setShowProfileForm(false);
      setProfileLoading(false);
      setUsername("");
      setProfileError(null);
      setWalletError(null);
      setRememberMe(false);
      setEmailVerified(false);
      setResendLeft(0);
      setCodePreview(null);
      clearResendTimer();
      setWalletStep("select");
      setIsNewUserFlow(false);
    }
  }, [isOpen, user, clearResendTimer]);

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      const addr = normalizedAccount || "";
      if (!addr) {
        onClose();
        return;
      }
      if (showProfileForm) return;

      setProfileLoading(true);
      (async () => {
        try {
          const data = await fetcher<UserProfileInfoResponse>(
            `/api/user-profiles?address=${encodeURIComponent(addr)}`
          );
          const p = data?.profile;
          if (!p?.username || !p?.email) {
            setShowProfileForm(true);
            setWalletStep("profile");
            setUsername(String(p?.username || ""));
            setEmail(String(p?.email || ""));
          } else {
            onClose();
          }
        } catch {
        } finally {
          setProfileLoading(false);
        }
      })();
    }
  }, [user, isOpen, onClose, normalizedAccount, showProfileForm]);

  useEffect(() => {
    if (!isOpen) return;
    if (!showProfileForm) return;
    if (isNewUserFlow) return; // 新用户流程，跳过自动获取（保留空用户名让用户填）
    const addr = normalizedAccount || "";
    if (!addr) return;
    setProfileLoading(true);
    setProfileError(null);
    (async () => {
      try {
        const data = await fetcher<UserProfileInfoResponse>(
          `/api/user-profiles?address=${encodeURIComponent(addr)}`
        );
        const p = data?.profile;
        if (p) {
          setUsername(String(p.username || ""));
          const nextEmail = String(p.email || "");
          setEmail(nextEmail);
          const verified = Boolean(nextEmail && /.+@.+\..+/.test(nextEmail));
          setEmailVerified(verified);
          verifiedEmailRef.current = verified ? nextEmail.trim().toLowerCase() : null;
        }
      } catch {
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [isOpen, showProfileForm, isNewUserFlow, normalizedAccount]);

  const setEmailWithReset = React.useCallback(
    (value: string) => {
      setEmail(value);
      const norm = String(value || "")
        .trim()
        .toLowerCase();
      if (verifiedEmailRef.current && norm === verifiedEmailRef.current) {
        setEmailVerified(true);
        return;
      }
      setEmailVerified(false);
      setOtpRequested(false);
      setOtp("");
      setCodePreview(null);
      clearResendTimer();
      setResendLeft(0);
    },
    [setOtpRequested, clearResendTimer]
  );

  const installMap: Record<string, { name: string; url: string }> = {
    metamask: { name: "MetaMask", url: "https://metamask.io/download/" },
    coinbase: {
      name: "Coinbase Wallet",
      url: "https://chrome.google.com/webstore/detail/coinbase-wallet-extension/hnfanknocfeofbddgcijnmhnfnkdnaad",
    },
    binance: {
      name: "Binance Wallet",
      url: "https://chrome.google.com/webstore/detail/binance-wallet/fhbohimaelbohpjbbldcngcnapndodjp",
    },
    okx: {
      name: "OKX Wallet",
      url: "https://chrome.google.com/webstore/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge",
    },
    kaia: {
      name: "Kaia Wallet",
      url: "https://chromewebstore.google.com/detail/kaia-wallet/jblndlipeogpafnldhgmapagcccfchpi",
    },
    trust: {
      name: "Trust Wallet",
      url: "https://trustwallet.com/browser-extension",
    },
  };

  const handleWalletConnect = async (walletType: string, isAvailable?: boolean) => {
    if (!isAvailable) {
      setWalletError(null);
      const cfg = installMap[walletType] || {
        name: walletType,
        url: "https://metamask.io/download/",
      };
      setInstallWalletName(cfg.name);
      setInstallUrl(cfg.url);
      setInstallPromptOpen(true);
      return;
    }
    setSelectedWallet(walletType);
    setWalletError(null);
    try {
      // 步骤 1: 连接钱包
      setWalletStep("connecting");
      const connectRes = await connectWalletWithResult(walletType as any);
      if (!connectRes.success) {
        logClientErrorToApi(
          new Error(`wallet_connect_failed:${String(connectRes.error || "unknown")}`),
          { silent: true }
        );
        setWalletError(connectRes.error);
        setWalletStep("select");
        return;
      }

      // 步骤 2: 请求权限（可选，快速跳过）
      setPermLoading(true);
      setWalletStep("permissions");
      try {
        await requestWalletPermissions();
      } catch {
        // 权限请求失败不阻塞流程
      }
      setPermLoading(false);

      // 步骤 3: SIWE 签名认证
      setSiweLoading(true);
      setWalletStep("sign");
      const res = await siweLogin();
      setSiweLoading(false);

      if (!res.success) {
        console.error("Sign-in with wallet failed:", res.error);
        logClientErrorToApi(new Error(`wallet_signin_failed:${String(res.error || "unknown")}`), {
          silent: true,
        });
        setWalletError(res.error || tGlobal("errors.wallet.loginError"));
        setWalletStep("select");
        setSelectedWallet(null);
        return;
      }

      if (auth?.refreshSession) {
        await auth.refreshSession();
      }

      const addrCheck = String(res.address || connectRes.account || account || "").toLowerCase();
      if (addrCheck) {
        try {
          const r = await fetch(`/api/user-profiles?address=${encodeURIComponent(addrCheck)}`);
          const d = await r.json();
          const p = d?.data?.profile;
          if (!p?.username || !p?.email) {
            setShowProfileForm(true);
            setWalletStep("profile");
            setUsername(String(p?.username || ""));
            const nextEmail = String(p?.email || "");
            setEmail(nextEmail);
            const verified = Boolean(nextEmail && /.+@.+\..+/.test(nextEmail));
            setEmailVerified(verified);
            verifiedEmailRef.current = verified ? nextEmail.trim().toLowerCase() : null;
            setSelectedWallet(null);
            return;
          }
        } catch {}
      }

      setWalletStep("completed");
      setSelectedWallet(null);
      onClose();
    } catch (error) {
      console.error("Wallet connection failed:", error);
      logClientErrorToApi(
        error instanceof Error ? error : new Error(String(error || "wallet_connect_failed")),
        { silent: true }
      );
      setWalletError(
        String((error as any)?.message || error || tGlobal("errors.wallet.loginError"))
      );
      // 出错时重置状态
      setWalletStep("select");
      setSiweLoading(false);
      setPermLoading(false);
      setMultiLoading(false);
    } finally {
      setSelectedWallet(null);
    }
  };

  const canRequest = /.+@.+\..+/.test(email);

  const sendLoginEmailAndGo = async () => {
    if (!canRequest || !auth) return;
    setEmailLoading(true);
    try {
      const redirect =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : "/";
      const data = await auth.sendMagicLink(email, redirect);
      const params = new URLSearchParams();
      params.set("email", email.trim().toLowerCase());
      if (redirect) {
        params.set("redirect", redirect);
      }
      if (data?.codePreview) {
        params.set("codePreview", String(data.codePreview));
      }
      router.push(`/login/callback?${params.toString()}`);
      onClose();
    } catch (error) {
      logClientErrorToApi(
        error instanceof Error ? error : new Error(String(error || "email_magic_link_failed")),
        { silent: true }
      );
    }
    setEmailLoading(false);
  };

  const handleRequestOtp = async () => {
    await sendLoginEmailAndGo();
  };

  const handleVerifyOtp = async () => {
    if (!email || !otp || !auth) return;
    setEmailLoading(true);
    try {
      const res = await auth.verifyEmailOtp(email, otp);
      if (res && typeof res === "object" && "isNewUser" in res && res.isNewUser) {
        setIsNewUserFlow(true);
        setShowProfileForm(true);
        setWalletStep("profile");
        // 获取生成的默认用户名（通过 refreshSession 更新后的 user）
        // 但由于 react 状态更新可能是异步的，这里 auth.user 可能还不是最新的
        // 我们可以假设后端生成了用户名，让用户确认或修改
        // 或者清空 username 让用户自己填
        // 这里选择让用户自己填，因为是 "要求输入用户名"
        setUsername("");
        setEmailVerified(true);
        setEmailLoading(false);
        return;
      }
      onClose();
    } catch (error) {
      logClientErrorToApi(
        error instanceof Error ? error : new Error(String(error || "email_otp_verify_failed")),
        { silent: true }
      );
    }
    setEmailLoading(false);
  };

  const handleSendMagicLink = async () => {
    await sendLoginEmailAndGo();
  };

  const canSubmitProfile =
    username.length >= 3 &&
    username.length <= 20 &&
    /^\w+$/.test(username) &&
    /.+@.+\..+/.test(email) &&
    emailVerified;

  const submitProfile = async () => {
    setProfileError(null);
    setProfileLoading(true);
    try {
      const addr = String(account || user?.id || "").toLowerCase();

      const errors: string[] = [];
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
        errors.push(tWalletModal("errors.invalidWalletAddress"));
      }
      if (!username || !email) {
        errors.push(tWalletModal("errors.usernameEmailRequired"));
      }
      if (!(username.length >= 3 && username.length <= 20 && /^\w+$/.test(username))) {
        errors.push(tWalletModal("errors.usernameInvalid"));
      }
      if (!/.+@.+\..+/.test(email)) {
        errors.push(tWalletModal("errors.emailFormatInvalid"));
      }
      if (!emailVerified) {
        errors.push(tWalletModal("errors.emailNotVerified"));
      }
      if (errors.length > 0) {
        setProfileError(errors.join(" ; "));
        return;
      }

      await fetcher<{ ok: boolean }>("/api/user-profiles", {
        method: "POST",
        body: JSON.stringify({ walletAddress: addr, username, email, rememberMe }),
      });
      if (auth?.refreshSession) {
        await auth.refreshSession();
      }
      if (userProfile?.refreshProfile) {
        await userProfile.refreshProfile();
      }
      setWalletStep("completed");
      onClose();
    } catch (error: any) {
      handleApiError(error, "walletModal.errors.submitFailed");
      setProfileError(String(error?.message || error || tWalletModal("errors.submitFailed")));
    } finally {
      setProfileLoading(false);
    }
  };

  const requestRegisterOtp = async () => {
    if (!account || !/.+@.+\..+/.test(email)) return;
    setProfileError(null);
    setEmailLoading(true);
    try {
      const addr = String(account || "").toLowerCase();
      const data = await fetcher<EmailOtpRequestResult>("/api/email-otp/request", {
        method: "POST",
        body: JSON.stringify({ walletAddress: addr, email }),
      });
      setOtpRequested(true);
      setEmailVerified(false);
      verifiedEmailRef.current = null;
      if (data?.codePreview) {
        setOtp(String(data.codePreview || ""));
        setCodePreview(String(data.codePreview || ""));
      } else {
        setCodePreview(null);
      }
      startResendCountdown(60);
    } catch (error: any) {
      handleApiError(error, "walletModal.errors.otpSendFailed");
      logClientErrorToApi(
        error instanceof Error ? error : new Error(String(error || "email_otp_request_failed")),
        { silent: true }
      );
      const raw = error as any;
      const inner =
        raw && typeof raw === "object" && raw.error && typeof raw.error === "object"
          ? raw.error
          : null;
      const details = inner && typeof inner.details === "object" ? inner.details : null;
      if (details && typeof details === "object") {
        const reason = String((details as any).reason || "");
        if (reason === "GLOBAL_MIN_INTERVAL") {
          startResendCountdown(60);
        } else if (reason === "EMAIL_LOCKED" && typeof (details as any).waitMinutes === "number") {
          const seconds = Math.max(60, Math.round((details as any).waitMinutes * 60));
          startResendCountdown(seconds);
        } else if (
          (reason === "EMAIL_TOO_FREQUENT" || reason === "IP_RATE_LIMIT") &&
          typeof (details as any).windowMinutes === "number"
        ) {
          const seconds = Math.max(60, Math.round((details as any).windowMinutes * 60));
          startResendCountdown(seconds);
        }
      }
      setProfileError(String(error?.message || tWalletModal("errors.otpSendFailed")));
    } finally {
      setEmailLoading(false);
    }
  };

  const verifyRegisterOtp = async () => {
    if (!account || !email || otp.length !== 6) return;
    setProfileError(null);
    setEmailLoading(true);
    try {
      const addr = String(account || "").toLowerCase();
      const res = await fetcher<
        EmailOtpVerifyResult & { requireUsername?: boolean; signupToken?: string }
      >("/api/email-otp/verify", {
        method: "POST",
        body: JSON.stringify({ walletAddress: addr, email, code: otp }),
      });

      if (res.requireUsername && res.signupToken) {
        setRequireUsername(true);
        setSignupToken(res.signupToken);
        setOtpRequested(false);
        setOtp("");
        setCodePreview(null);
        clearResendTimer();
        setResendLeft(0);
        return;
      }

      setEmailVerified(true);
      verifiedEmailRef.current = email.trim().toLowerCase();
      setOtpRequested(false);
      setOtp("");
      setCodePreview(null);
      clearResendTimer();
      setResendLeft(0);
    } catch (error: any) {
      handleApiError(error, "walletModal.errors.otpVerifyFailed");
      logClientErrorToApi(
        error instanceof Error ? error : new Error(String(error || "email_otp_verify_failed")),
        { silent: true }
      );
      const raw = error as any;
      const inner =
        raw && typeof raw === "object" && raw.error && typeof raw.error === "object"
          ? raw.error
          : null;
      const details = inner && typeof inner.details === "object" ? inner.details : null;
      if (details && typeof details === "object") {
        const reason = String((details as any).reason || "");
        if (reason === "EMAIL_LOCKED" && typeof (details as any).waitMinutes === "number") {
          const seconds = Math.max(60, Math.round((details as any).waitMinutes * 60));
          startResendCountdown(seconds);
        } else if (reason === "OTP_TOO_MANY_ATTEMPTS") {
          startResendCountdown(60 * 60);
        }
      }
      setProfileError(String(error?.message || tWalletModal("errors.otpVerifyFailed")));
    } finally {
      setEmailLoading(false);
    }
  };

  const completeSignup = async () => {
    if (!username || !signupToken) return;
    setProfileError(null);
    setEmailLoading(true);
    try {
      await fetcher("/api/email-otp/complete-signup", {
        method: "POST",
        body: JSON.stringify({ signupToken, username }),
      });

      setEmailVerified(true);
      verifiedEmailRef.current = email.trim().toLowerCase();
      setRequireUsername(false);
      setSignupToken(null);
    } catch (error: any) {
      handleApiError(error, "walletModal.errors.unknown");
      logClientErrorToApi(
        error instanceof Error ? error : new Error(String(error || "email_signup_failed")),
        { silent: true }
      );
      setProfileError(String(error?.message || "Failed to complete signup"));
    } finally {
      setEmailLoading(false);
    }
  };

  let stepHint = tWalletModal("hints.selectLoginMethod");
  if (walletStep === "connecting") {
    stepHint = tWalletModal("hints.connectingWallet");
  } else if (walletStep === "permissions") {
    stepHint = tWalletModal("hints.requestingPermissions");
  } else if (walletStep === "sign") {
    stepHint = tWalletModal("hints.signToLogin");
  } else if (walletStep === "multisig") {
    stepHint = tWalletModal("hints.completingMultisig");
  } else if (showProfileForm && !emailVerified) {
    stepHint = tWalletModal("hints.completeProfileAndVerifyEmail");
  } else if (showProfileForm && emailVerified) {
    stepHint = tWalletModal("hints.emailVerifiedSaveProfile");
  } else if (walletStep === "completed" || user) {
    stepHint = tWalletModal("hints.walletBoundComplete");
  }

  const step1Active = walletStep === "connecting";
  const step2Active =
    walletStep === "permissions" || walletStep === "sign" || walletStep === "multisig";
  const step3Active = showProfileForm && !emailVerified;

  const step1Done = walletStep !== "select" && !step1Active;
  const step2Done =
    walletStep === "profile" || walletStep === "completed" || (!!user && !showProfileForm);
  const step3Done = emailVerified || walletStep === "completed" || (!!user && !showProfileForm);

  return {
    tWalletModal,
    tLogin,
    user,
    authError,
    selectedWallet,
    email,
    setEmail: setEmailWithReset,
    otpRequested,
    setOtpRequested,
    otp,
    setOtp,
    emailLoading,
    siweLoading,
    permLoading,
    multiLoading,
    showProfileForm,
    setShowProfileForm,
    profileLoading,
    username,
    setUsername,
    profileError,
    walletError,
    rememberMe,
    setRememberMe,
    requireUsername,
    completeSignup,
    emailVerified,
    resendLeft,
    codePreview,
    installPromptOpen,
    setInstallPromptOpen,
    installWalletName,
    installUrl,
    walletStep,
    canRequest,
    canSubmitProfile,
    handleWalletConnect,
    handleRequestOtp,
    handleVerifyOtp,
    handleSendMagicLink,
    submitProfile,
    requestRegisterOtp,
    verifyRegisterOtp,
    mounted,
    stepHint,
    step1Active,
    step2Active,
    step3Active,
    step1Done,
    step2Done,
    step3Done,
    availableWallets,
    isConnecting,
  };
}
