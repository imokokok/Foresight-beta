"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useTranslations } from "@/lib/i18n";
import { normalizeAddress } from "@/lib/address";
import { useEmailVerification } from "./walletModal/useEmailVerification";
import { useProfileForm } from "./walletModal/useProfileForm";
import { useWalletConnectionFlow, type WalletStep } from "./walletModal/useWalletConnectionFlow";
export type { WalletStep };

export interface UseWalletModalOptions {
  isOpen: boolean;
  onClose: () => void;
}

export function useWalletModalLogic({ isOpen, onClose }: UseWalletModalOptions) {
  const { address } = useWallet();
  const normalizedAccount = address ? normalizeAddress(address) : undefined;
  const tWalletModal = useTranslations("walletModal");
  const tLogin = useTranslations("login");
  const [mounted, setMounted] = useState(false);
  const [isNewUserFlow, setIsNewUserFlow] = useState(false);

  // 使用自定义 hooks
  const emailVerification = useEmailVerification(address);
  const profileForm = useProfileForm({
    address,
    normalizedAccount,
    email: emailVerification.email,
    setEmail: emailVerification.setEmail,
    emailVerified: emailVerification.emailVerified,
    verifiedEmailRef: emailVerification.verifiedEmailRef,
    isOpen,
    isNewUserFlow,
  });

  const walletFlow = useWalletConnectionFlow({
    address,
    onClose,
    onShowProfileForm: useCallback(
      (email: string, verified: boolean) => {
        profileForm.setShowProfileForm(true);
        emailVerification.setEmail(email);
        emailVerification.setEmailVerified(verified);
      },
      [emailVerification, profileForm]
    ),
  });

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
      return;
    }
    if (!address) {
      walletFlow.setWalletStep("select");
      setIsNewUserFlow(false);
    }
  }, [isOpen, address, walletFlow]);

  // 处理邮箱验证结果
  const handleVerifyOtpResult = useCallback(
    async (result: { isNewUser?: boolean } | null) => {
      if (result?.isNewUser) {
        setIsNewUserFlow(true);
        profileForm.setShowProfileForm(true);
        profileForm.setUsername("");
        emailVerification.setEmailVerified(true);
        walletFlow.setWalletStep("profile");
      } else {
        onClose();
      }
    },
    [profileForm, emailVerification, walletFlow, onClose]
  );

  const handleVerifyOtp = useCallback(async () => {
    try {
      const result = await emailVerification.handleVerifyOtp();
      await handleVerifyOtpResult(result);
    } catch (error) {
      // 错误已在 hook 中处理
    }
  }, [emailVerification, handleVerifyOtpResult]);

  const handleRequestOtp = useCallback(async () => {
    await emailVerification.handleRequestOtp();
    onClose();
  }, [emailVerification, onClose]);

  const handleSendMagicLink = useCallback(async () => {
    await emailVerification.handleSendMagicLink();
    onClose();
  }, [emailVerification, onClose]);

  const requestRegisterOtp = useCallback(async () => {
    try {
      await emailVerification.requestRegisterOtp();
    } catch (error: any) {
      profileForm.setProfileError(String(error?.message || tWalletModal("errors.otpSendFailed")));
    }
  }, [emailVerification, profileForm, tWalletModal]);

  const verifyRegisterOtp = useCallback(async () => {
    try {
      const result = await emailVerification.verifyRegisterOtp();
      if (result?.requireUsername && result.signupToken) {
        profileForm.setRequireUsername(true);
        profileForm.setSignupToken(result.signupToken);
      }
    } catch (error: any) {
      profileForm.setProfileError(String(error?.message || tWalletModal("errors.otpVerifyFailed")));
    }
  }, [emailVerification, profileForm, tWalletModal]);

  const submitProfile = useCallback(async () => {
    await profileForm.submitProfile();
    walletFlow.setWalletStep("completed");
    onClose();
  }, [profileForm, walletFlow, onClose]);

  const stepHint = (() => {
    if (walletFlow.walletStep === "connecting") {
      return tWalletModal("hints.connectingWallet");
    } else if (walletFlow.walletStep === "permissions") {
      return tWalletModal("hints.requestingPermissions");
    } else if (walletFlow.walletStep === "sign") {
      return tWalletModal("hints.signToLogin");
    } else if (walletFlow.walletStep === "multisig") {
      return tWalletModal("hints.completingMultisig");
    } else if (profileForm.showProfileForm && !emailVerification.emailVerified) {
      return tWalletModal("hints.completeProfileAndVerifyEmail");
    } else if (profileForm.showProfileForm && emailVerification.emailVerified) {
      return tWalletModal("hints.emailVerifiedSaveProfile");
    } else if (walletFlow.walletStep === "completed" || address) {
      return tWalletModal("hints.walletBoundComplete");
    }
    return tWalletModal("hints.selectLoginMethod");
  })();

  const step1Active = walletFlow.walletStep === "connecting";
  const step2Active =
    walletFlow.walletStep === "permissions" ||
    walletFlow.walletStep === "sign" ||
    walletFlow.walletStep === "multisig";
  const step3Active = profileForm.showProfileForm && !emailVerification.emailVerified;

  const step1Done = walletFlow.walletStep !== "select" && !step1Active;
  const step2Done =
    walletFlow.walletStep === "profile" ||
    walletFlow.walletStep === "completed" ||
    (!!address && !profileForm.showProfileForm);
  const step3Done =
    emailVerification.emailVerified ||
    walletFlow.walletStep === "completed" ||
    (!!address && !profileForm.showProfileForm);

  return {
    tWalletModal,
    tLogin,
    selectedWallet: walletFlow.selectedWallet,
    email: emailVerification.email,
    setEmail: emailVerification.setEmail,
    otpRequested: emailVerification.otpRequested,
    setOtpRequested: emailVerification.setOtpRequested,
    otp: emailVerification.otp,
    setOtp: emailVerification.setOtp,
    emailLoading: emailVerification.emailLoading,
    siweLoading: walletFlow.siweLoading,
    permLoading: walletFlow.permLoading,
    multiLoading: walletFlow.multiLoading,
    showProfileForm: profileForm.showProfileForm,
    setShowProfileForm: profileForm.setShowProfileForm,
    profileLoading: profileForm.profileLoading,
    username: profileForm.username,
    setUsername: profileForm.setUsername,
    profileError: profileForm.profileError,
    walletError: walletFlow.walletError,
    rememberMe: profileForm.rememberMe,
    setRememberMe: profileForm.setRememberMe,
    requireUsername: profileForm.requireUsername,
    completeSignup: profileForm.completeSignup,
    emailVerified: emailVerification.emailVerified,
    resendLeft: emailVerification.resendLeft,
    codePreview: emailVerification.codePreview,
    installPromptOpen: walletFlow.installPromptOpen,
    setInstallPromptOpen: walletFlow.setInstallPromptOpen,
    installWalletName: walletFlow.installWalletName,
    installUrl: walletFlow.installUrl,
    walletStep: walletFlow.walletStep,
    canRequest: emailVerification.canRequest,
    canSubmitProfile: profileForm.canSubmitProfile,
    handleWalletConnect: walletFlow.handleWalletConnect,
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
    availableWallets: walletFlow.availableWallets,
    isConnecting: walletFlow.isConnecting,
  };
}
