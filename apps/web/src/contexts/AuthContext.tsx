"use client";
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useTranslations } from "@/lib/i18n";
import { getFeatureFlags } from "@/lib/runtimeConfig";
import { isApiErrorResponse, type ApiResponse } from "@foresight/shared/api";
import { createUnauthorizedError } from "@/lib/errorHandling";

interface EmailOtpRequestResponse {
  expiresInSec: number;
  resendAfterSec?: number;
  codePreview?: string;
}

interface EmailMagicLinkRequestResponse {
  expiresInSec: number;
  resendAfterSec?: number;
  codePreview?: string;
  magicLinkPreview?: string;
}

export interface AuthUser {
  id: string;
  email?: string | null;
  user_metadata?: { username?: string };
}

interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  user: AuthUser | null;
  requestEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ isNewUser?: boolean } | void>;
  sendMagicLink: (email: string, redirect?: string) => Promise<EmailMagicLinkRequestResponse>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchApiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !json || isApiErrorResponse(json)) {
    const errorResponse = json as ApiResponse<T>;
    let errorMessage: string;

    if (isApiErrorResponse(errorResponse)) {
      errorMessage = errorResponse.error.message;
    } else {
      errorMessage = json
        ? (json as { message?: string })?.message || `Request failed: ${res.status}`
        : `Request failed: ${res.status}`;
    }

    throw createUnauthorizedError(errorMessage);
  }

  if ("data" in json) {
    return json.data;
  }

  return json as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const tWalletModal = useTranslations("walletModal");
  const tGlobal = useTranslations();
  const embeddedAuthEnabled = getFeatureFlags().embedded_auth_enabled;
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const normalizeHttpErrorMessage = (message: string) => {
    const m = message.match(new RegExp("Request failed:\\s*(\\d{3})"));
    const status = m ? Number(m[1]) : null;
    if (!status) return message;
    const key = `errors.api.${status}.description`;
    const translated = tGlobal(key);
    return translated === key ? message : translated;
  };

  const checkAuthStatus = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/auth/me", { signal: abortControllerRef.current.signal });
      if (!mountedRef.current) return;

      if (res.ok) {
        const userData = await res.json();
        if (!mountedRef.current) return;
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        if (!mountedRef.current) return;
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      if (!mountedRef.current || (error instanceof DOMException && error.name === "AbortError"))
        return;
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    checkAuthStatus();
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const requestEmailOtp = async (email: string) => {
    setError(null);
    try {
      if (!embeddedAuthEnabled) {
        const msg = tGlobal("errors.api.503.description");
        setError(msg);
        throw createUnauthorizedError(msg);
      }
      await fetchApiJson<EmailOtpRequestResponse>("/api/email-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode: "login" }),
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const raw = errorMessage ? errorMessage : tWalletModal("errors.otpSendFailed");
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
        throw createUnauthorizedError(msg);
      }
      const data = await fetchApiJson<{ ok: boolean; address?: string; isNewUser?: boolean }>(
        "/api/email-otp/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: token, mode: "login" }),
        }
      );
      return data;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const raw = errorMessage ? errorMessage : tWalletModal("errors.otpVerifyFailed");
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
        throw createUnauthorizedError(msg);
      }
      return await fetchApiJson<EmailMagicLinkRequestResponse>("/api/email-magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirect }),
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const raw = errorMessage ? errorMessage : tWalletModal("errors.otpSendFailed");
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
    setIsAuthenticated(false);
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextValue = {
    isAuthenticated,
    loading,
    error,
    user,
    requestEmailOtp,
    verifyEmailOtp,
    sendMagicLink,
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useAuthOptional() {
  return useContext(AuthContext);
}
