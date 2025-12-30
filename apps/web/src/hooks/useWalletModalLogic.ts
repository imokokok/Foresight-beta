"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useTranslations } from "@/lib/i18n";

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
  const {
    connectWallet,
    availableWallets,
    isConnecting,
    siweLogin,
    requestWalletPermissions,
    multisigSign,
    account,
  } = useWallet();
  const auth = useAuthOptional();
  const userProfile = useUserProfileOptional();
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
  const [rememberMe, setRememberMe] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [codePreview, setCodePreview] = useState<string | null>(null);
  const resendTimerRef = React.useRef<number | null>(null);
  const [installPromptOpen, setInstallPromptOpen] = useState(false);
  const [installWalletName, setInstallWalletName] = useState<string>("");
  const [installUrl, setInstallUrl] = useState<string>("");
  const [walletStep, setWalletStep] = useState<WalletStep>("select");
  const [mounted, setMounted] = useState(false);

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
    if (!isOpen) return;
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
      setRememberMe(false);
      setEmailVerified(false);
      setResendLeft(0);
      setCodePreview(null);
      setWalletStep("select");
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      const addr = String(account || "").toLowerCase();
      if (addr) {
        if (showProfileForm) return;

        setProfileLoading(true);
        fetch(`/api/user-profiles?address=${encodeURIComponent(addr)}`)
          .then((r) => r.json())
          .then((data) => {
            const p = data?.profile;
            if (!p?.username || !p?.email) {
              setShowProfileForm(true);
              setUsername(String(p?.username || ""));
              setEmail(String(p?.email || ""));
            } else {
              onClose();
            }
          })
          .catch(() => {})
          .finally(() => setProfileLoading(false));
      } else {
        setProfileLoading(false);
      }
    }
  }, [user, isOpen, onClose, account, showProfileForm]);

  useEffect(() => {
    if (!isOpen) return;
    if (!showProfileForm) return;
    const addr = String(account || "").toLowerCase();
    if (!addr) return;
    setProfileLoading(true);
    setProfileError(null);
    fetch(`/api/user-profiles?address=${encodeURIComponent(addr)}`)
      .then((r) => r.json())
      .then((data) => {
        const p = data?.profile;
        if (p) {
          setUsername(String(p.username || ""));
          setEmail(String(p.email || ""));
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [isOpen, showProfileForm, account]);

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
  };

  const handleWalletConnect = async (walletType: string, isAvailable?: boolean) => {
    if (!isAvailable) {
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
    try {
      // 步骤 1: 连接钱包
      setWalletStep("connecting");
      await connectWallet(walletType as any);
      
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
        // SIWE 失败，重置状态让用户可以重试
        setWalletStep("select");
        setSelectedWallet(null);
        return;
      }
      
      // SIWE 成功，刷新会话
      if (auth?.refreshSession) {
        await auth.refreshSession();
      }
      
      // 检查用户 profile
      const addrCheck = String(res.address || account || "").toLowerCase();
      if (addrCheck) {
        try {
          const r = await fetch(`/api/user-profiles?address=${encodeURIComponent(addrCheck)}`);
          const d = await r.json();
          const p = d?.profile;
          if (!p?.username || !p?.email) {
            // 需要完善 profile
            setShowProfileForm(true);
            setWalletStep("profile");
            setUsername(String(p?.username || ""));
            setEmail(String(p?.email || ""));
            setSelectedWallet(null);
            return;
          }
        } catch {}
      }
      
      // 登录完成
      setWalletStep("completed");
      setSelectedWallet(null);
      onClose();
      
    } catch (error) {
      console.error("Wallet connection failed:", error);
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

  const handleRequestOtp = async () => {
    if (!canRequest || !auth) return;
    setEmailLoading(true);
    try {
      await auth.requestEmailOtp(email);
      setOtpRequested(true);
    } catch {}
    setEmailLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!email || !otp || !auth) return;
    setEmailLoading(true);
    try {
      await auth.verifyEmailOtp(email, otp);
      onClose();
    } catch {}
    setEmailLoading(false);
  };

  const handleSendMagicLink = async () => {
    if (!canRequest || !auth) return;
    setEmailLoading(true);
    try {
      await auth.sendMagicLink(email);
      setOtpRequested(true);
    } catch {}
    setEmailLoading(false);
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
      const addr = String(account || "").toLowerCase();

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

      const resp = await fetch("/api/user-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr, username, email, rememberMe }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.success) {
        setProfileError(String(json?.message || tWalletModal("errors.submitFailed")));
      } else {
        if (auth?.refreshSession) {
          await auth.refreshSession();
        }
        if (userProfile?.refreshProfile) {
          await userProfile.refreshProfile();
        }
        setWalletStep("completed");
        onClose();
      }
    } catch (e: any) {
      setProfileError(String(e?.message || e));
    } finally {
      setProfileLoading(false);
    }
  };

  const requestRegisterOtp = async () => {
    if (!account || !/.+@.+\..+/.test(email)) return;
    setEmailLoading(true);
    try {
      const addr = String(account || "").toLowerCase();
      const resp = await fetch("/api/email-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr, email }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.success) {
        setProfileError(String(json?.message || tWalletModal("errors.otpSendFailed")));
      } else {
        setOtpRequested(true);
        setEmailVerified(false);
        if (json?.codePreview) {
          setOtp(String(json.codePreview || ""));
          setCodePreview(String(json.codePreview || ""));
        } else {
          setCodePreview(null);
        }
      }
    } catch (e: any) {
      setProfileError(String(e?.message || e));
    } finally {
      setEmailLoading(false);
    }
  };

  const verifyRegisterOtp = async () => {
    if (!account || !email || otp.length !== 6) return;
    setEmailLoading(true);
    try {
      const addr = String(account || "").toLowerCase();
      const resp = await fetch("/api/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr, email, code: otp }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.success) {
        setProfileError(String(json?.message || tWalletModal("errors.otpVerifyFailed")));
      } else {
        setEmailVerified(true);
      }
    } catch (e: any) {
      setProfileError(String(e?.message || e));
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
    setEmail,
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
    rememberMe,
    setRememberMe,
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
