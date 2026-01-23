"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { fetcher, type EmailOtpRequestResult, type EmailOtpVerifyResult } from "@/hooks/useQueries";
import { handleApiError } from "@/lib/toast";
import { logClientErrorToApi } from "@/lib/errorReporting";
import { useResendTimer } from "./useResendTimer";
import { useTranslations } from "@/lib/i18n";

export function useEmailVerification(account: string | null | undefined) {
  const router = useRouter();
  const auth = useAuthOptional();
  const tWalletModal = useTranslations("walletModal");
  const { clearResendTimer, startResendCountdown } = useResendTimer();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [codePreview, setCodePreview] = useState<string | null>(null);
  const verifiedEmailRef = useRef<string | null>(null);

  const canRequest = /.+@.+\..+/.test(email);

  const setEmailWithReset = useCallback(
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
    [clearResendTimer]
  );

  const sendLoginEmailAndGo = useCallback(async () => {
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
    } catch (error) {
      logClientErrorToApi(
        error instanceof Error ? error : new Error(String(error || "email_magic_link_failed")),
        { silent: true }
      );
    }
    setEmailLoading(false);
  }, [canRequest, auth, email, router]);

  const handleRequestOtp = useCallback(async () => {
    await sendLoginEmailAndGo();
  }, [sendLoginEmailAndGo]);

  const handleVerifyOtp = useCallback(async (): Promise<{ isNewUser: boolean } | null> => {
    if (!email || !otp || !auth) return null;
    setEmailLoading(true);
    try {
      const res = await auth.verifyEmailOtp(email, otp);
      if (res && typeof res === "object" && "isNewUser" in res && res.isNewUser) {
        setEmailVerified(true);
        return { isNewUser: true };
      }
      setEmailVerified(true);
      return { isNewUser: false };
    } catch (error) {
      logClientErrorToApi(
        error instanceof Error ? error : new Error(String(error || "email_otp_verify_failed")),
        { silent: true }
      );
      throw error;
    } finally {
      setEmailLoading(false);
    }
  }, [email, otp, auth]);

  const handleSendMagicLink = useCallback(async () => {
    await sendLoginEmailAndGo();
  }, [sendLoginEmailAndGo]);

  const requestRegisterOtp = useCallback(async () => {
    if (!account || !/.+@.+\..+/.test(email)) return;
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
      startResendCountdown(60, setResendLeft);
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
          startResendCountdown(60, setResendLeft);
        } else if (reason === "EMAIL_LOCKED" && typeof (details as any).waitMinutes === "number") {
          const seconds = Math.max(60, Math.round((details as any).waitMinutes * 60));
          startResendCountdown(seconds, setResendLeft);
        } else if (
          (reason === "EMAIL_TOO_FREQUENT" || reason === "IP_RATE_LIMIT") &&
          typeof (details as any).windowMinutes === "number"
        ) {
          const seconds = Math.max(60, Math.round((details as any).windowMinutes * 60));
          startResendCountdown(seconds, setResendLeft);
        }
      }
      throw error;
    } finally {
      setEmailLoading(false);
    }
  }, [account, email, startResendCountdown]);

  const verifyRegisterOtp = useCallback(async () => {
    if (!account || !email || otp.length !== 6) return null;
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
        setOtpRequested(false);
        setOtp("");
        setCodePreview(null);
        clearResendTimer();
        setResendLeft(0);
        return { requireUsername: true, signupToken: res.signupToken };
      }

      setEmailVerified(true);
      verifiedEmailRef.current = email.trim().toLowerCase();
      setOtpRequested(false);
      setOtp("");
      setCodePreview(null);
      clearResendTimer();
      setResendLeft(0);
      return { requireUsername: false };
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
          startResendCountdown(seconds, setResendLeft);
        } else if (reason === "OTP_TOO_MANY_ATTEMPTS") {
          startResendCountdown(60 * 60, setResendLeft);
        }
      }
      throw error;
    } finally {
      setEmailLoading(false);
    }
  }, [account, email, otp, clearResendTimer, startResendCountdown]);

  return {
    email,
    setEmail: setEmailWithReset,
    otp,
    setOtp,
    otpRequested,
    setOtpRequested,
    emailLoading,
    emailVerified,
    setEmailVerified,
    resendLeft,
    codePreview,
    canRequest,
    handleRequestOtp,
    handleVerifyOtp,
    handleSendMagicLink,
    requestRegisterOtp,
    verifyRegisterOtp,
    verifiedEmailRef,
  };
}
