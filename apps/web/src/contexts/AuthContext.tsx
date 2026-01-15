"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useTranslations } from "@/lib/i18n";
import { getFeatureFlags } from "@/lib/runtimeConfig";

interface AuthContextValue {
  user: { id: string; email: string | null; user_metadata?: any } | null;
  loading: boolean;
  error: string | null;
  // 发送邮箱 OTP / 魔法链接
  requestEmailOtp: (email: string) => Promise<void>;
  // 验证邮箱 OTP（6 位验证码）
  verifyEmailOtp: (email: string, token: string) => Promise<{ isNewUser?: boolean } | void>;
  // 可选：直接发送魔法链接（不输入验证码）
  sendMagicLink: (
    email: string,
    redirect?: string
  ) => Promise<{
    expiresInSec: number;
    resendAfterSec?: number;
    codePreview?: string;
    magicLinkPreview?: string;
  }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export type AuthUser = AuthContextValue["user"];

type ApiOk<T> = { success: true; data: T; message?: string };
type ApiFail = { success: false; error?: { message?: string } };

async function fetchApiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as ApiOk<T> | ApiFail | null;
  if (!res.ok || !json || (json as any).success !== true) {
    const msg =
      (json as any)?.error?.message || (json as any)?.message || `Request failed: ${res.status}`;
    throw new Error(String(msg));
  }
  return (json as ApiOk<T>).data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const tWalletModal = useTranslations("walletModal");
  const tGlobal = useTranslations();
  const embeddedAuthEnabled = getFeatureFlags().embedded_auth_enabled;

  const normalizeHttpErrorMessage = (message: string) => {
    const m = message.match(/Request failed:\s*(\d{3})/);
    const status = m ? Number(m[1]) : null;
    if (!status) return message;
    const key = `errors.api.${status}.description`;
    const translated = tGlobal(key);
    return translated === key ? message : translated;
  };

  const refreshSession = async () => {
    try {
      const me = await fetch("/api/auth/me", { method: "GET" });
      if (!me.ok) {
        setUser(null);
        return;
      }
      const meJson = (await me.json().catch(() => null)) as any;
      const address = typeof meJson?.address === "string" ? String(meJson.address) : "";
      if (!address) {
        setUser(null);
        return;
      }
      const profile = await fetchApiJson<{
        profile?: { email?: string; username?: string } | null;
      }>(`/api/user-profiles?address=${encodeURIComponent(address)}`, { method: "GET" }).catch(
        () => null
      );
      const email =
        profile && profile.profile && typeof profile.profile.email === "string"
          ? String(profile.profile.email)
          : null;
      const username =
        profile && profile.profile && typeof profile.profile.username === "string"
          ? String(profile.profile.username)
          : "";
      setUser({
        id: address,
        email,
        user_metadata: username ? { username } : undefined,
      });
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await refreshSession();
      } catch (e: any) {
        if (mounted) setError(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const requestEmailOtp = async (email: string) => {
    setError(null);
    try {
      if (!embeddedAuthEnabled) {
        const msg = tGlobal("errors.api.503.description");
        setError(msg);
        throw new Error(msg);
      }
      await fetchApiJson<{ expiresInSec: number; codePreview?: string }>("/api/email-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode: "login" }),
      });
    } catch (e: any) {
      const raw =
        typeof e?.message === "string" && e.message
          ? e.message
          : tWalletModal("errors.otpSendFailed");
      const msg = typeof raw === "string" ? normalizeHttpErrorMessage(raw) : raw;
      setError(msg);
      throw e;
    }
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    setError(null);
    try {
      if (!embeddedAuthEnabled) {
        const msg = tGlobal("errors.api.503.description");
        setError(msg);
        throw new Error(msg);
      }
      const data = await fetchApiJson<{ ok: boolean; address?: string; isNewUser?: boolean }>(
        "/api/email-otp/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: token, mode: "login" }),
        }
      );
      const address = typeof data?.address === "string" ? String(data.address) : "";
      setUser(address ? { id: address, email: email.trim().toLowerCase() } : null);
      await refreshSession();
      return data;
    } catch (e: any) {
      const raw =
        typeof e?.message === "string" && e.message
          ? e.message
          : tWalletModal("errors.otpVerifyFailed");
      const msg = typeof raw === "string" ? normalizeHttpErrorMessage(raw) : raw;
      setError(msg);
      throw e;
    }
  };

  const sendMagicLink = async (email: string, redirect?: string) => {
    setError(null);
    try {
      if (!embeddedAuthEnabled) {
        const msg = tGlobal("errors.api.503.description");
        setError(msg);
        throw new Error(msg);
      }
      return await fetchApiJson<{
        expiresInSec: number;
        resendAfterSec?: number;
        codePreview?: string;
        magicLinkPreview?: string;
      }>("/api/email-magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirect }),
      });
    } catch (e: any) {
      const raw =
        typeof e?.message === "string" && e.message
          ? e.message
          : tWalletModal("errors.otpSendFailed");
      const msg = typeof raw === "string" ? normalizeHttpErrorMessage(raw) : raw;
      setError(msg);
      throw e;
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    try {
      await fetch("/api/siwe/logout", { method: "POST" });
    } catch {}
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    loading,
    error,
    requestEmailOtp,
    verifyEmailOtp,
    sendMagicLink,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// 可选版本：在缺少 Provider 时返回 undefined，避免组件直接崩溃
export function useAuthOptional() {
  return useContext(AuthContext);
}
