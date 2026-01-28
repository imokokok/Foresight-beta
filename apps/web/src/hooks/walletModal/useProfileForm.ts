"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { fetcher, type UserProfileInfoResponse } from "@/hooks/useQueries";
import { handleApiError } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n";

export function useProfileForm({
  address,
  normalizedAccount,
  email,
  setEmail,
  emailVerified,
  verifiedEmailRef,
  isOpen,
  isNewUserFlow,
}: {
  address: string | null | undefined;
  normalizedAccount: string | null | undefined;
  email: string;
  setEmail: (email: string) => void;
  emailVerified: boolean;
  verifiedEmailRef: React.MutableRefObject<string | null>;
  isOpen: boolean;
  isNewUserFlow: boolean;
}) {
  const auth = useAuthOptional();
  const userProfile = useUserProfileOptional();
  const tWalletModal = useTranslations("walletModal");

  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [requireUsername, setRequireUsername] = useState(false);
  const [signupToken, setSignupToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowProfileForm(false);
      setProfileLoading(false);
      setUsername("");
      setProfileError(null);
      setRememberMe(false);
      setRequireUsername(false);
      setSignupToken(null);
      return;
    }
    if (address) {
      const addr = normalizedAccount || "";
      if (!addr) return;
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
            setUsername(String(p?.username || ""));
            const nextEmail = String(p?.email || "");
            const verified = Boolean(nextEmail && /.+@.+\..+/.test(nextEmail));
            verifiedEmailRef.current = verified ? nextEmail.trim().toLowerCase() : null;
            if (nextEmail) {
              setEmail(nextEmail);
            }
          }
        } catch {
        } finally {
          setProfileLoading(false);
        }
      })();
    }
  }, [address, isOpen, normalizedAccount, showProfileForm, setEmail, verifiedEmailRef]);

  useEffect(() => {
    if (!isOpen) return;
    if (!showProfileForm) return;
    if (isNewUserFlow) return;
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
          const verified = Boolean(nextEmail && /.+@.+\..+/.test(nextEmail));
          verifiedEmailRef.current = verified ? nextEmail.trim().toLowerCase() : null;
          if (nextEmail) {
            setEmail(nextEmail);
          }
        }
      } catch {
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [isOpen, showProfileForm, isNewUserFlow, normalizedAccount, verifiedEmailRef, setEmail]);

  const canSubmitProfile =
    username.length >= 3 &&
    username.length <= 20 &&
    /^\w+$/.test(username) &&
    /.+@.+\..+/.test(email) &&
    emailVerified;

  const submitProfile = useCallback(async () => {
    setProfileError(null);
    setProfileLoading(true);
    try {
      const addr = String(address || "").toLowerCase();

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
      if (userProfile?.refreshProfile) {
        await userProfile.refreshProfile();
      }
    } catch (error: any) {
      handleApiError(error, "walletModal.errors.submitFailed");
      setProfileError(String(error?.message || error || tWalletModal("errors.submitFailed")));
    } finally {
      setProfileLoading(false);
    }
  }, [address, username, email, emailVerified, rememberMe, userProfile, tWalletModal]);

  const completeSignup = useCallback(async () => {
    if (!username || !signupToken) return;
    setProfileError(null);
    setProfileLoading(true);
    try {
      await fetcher("/api/email-otp/complete-signup", {
        method: "POST",
        body: JSON.stringify({ signupToken, username }),
      });

      const norm = email.trim().toLowerCase();
      verifiedEmailRef.current = norm || null;
      if (norm) {
        setEmail(email);
      }
      setRequireUsername(false);
      setSignupToken(null);
    } catch (error: any) {
      handleApiError(error, "walletModal.errors.unknown");
      setProfileError(String(error?.message || "Failed to complete signup"));
    } finally {
      setProfileLoading(false);
    }
  }, [username, signupToken, email, verifiedEmailRef, setEmail]);

  return {
    showProfileForm,
    setShowProfileForm,
    profileLoading,
    username,
    setUsername,
    profileError,
    setProfileError,
    rememberMe,
    setRememberMe,
    requireUsername,
    setRequireUsername,
    signupToken,
    setSignupToken,
    canSubmitProfile,
    submitProfile,
    completeSignup,
  };
}
