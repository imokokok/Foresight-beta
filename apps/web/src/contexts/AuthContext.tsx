"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: { id: string; email: string | null } | null;
  loading: boolean;
  error: string | null;
  // 发送邮箱 OTP / 魔法链接
  requestEmailOtp: (email: string) => Promise<void>;
  // 验证邮箱 OTP（6 位验证码）
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  // 可选：直接发送魔法链接（不输入验证码）
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // 初始化会话
    if (!supabase) {
      setLoading(false);
      return;
    }
    (supabase as any).auth.getSession().then(({ data, error }: any) => {
      if (!mounted) return;
      if (error) {
        setError(error.message);
      }
      const sessUser = data?.session?.user || null;
      setUser(sessUser ? { id: sessUser.id, email: sessUser.email ?? null } : null);
      setLoading(false);
    });

    // 监听会话变化
    const { data: sub } = (supabase as any).auth.onAuthStateChange((_event: any, session: any) => {
      const sessUser = session?.user || null;
      setUser(sessUser ? { id: sessUser.id, email: sessUser.email ?? null } : null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Polymarket 风格：默认发送 OTP，同时也支持魔法链接
  const requestEmailOtp = async (email: string) => {
    setError(null);
    try {
      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      if (!supabase) throw new Error("Supabase 未配置");
      const { error } = await (supabase as any).auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      setEmailPending(email);
    } catch (e: any) {
      setError(e?.message || String(e));
      throw e;
    }
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    setError(null);
    try {
      if (!supabase) throw new Error("Supabase 未配置");
      const { data, error } = await (supabase as any).auth.verifyOtp({
        type: "email",
        email,
        token,
      });
      if (error) throw error;
      const sessUser = data?.user || data?.session?.user || null;
      setUser(sessUser ? { id: sessUser.id, email: sessUser.email ?? null } : null);
      setEmailPending(null);
    } catch (e: any) {
      setError(e?.message || String(e));
      throw e;
    }
  };

  const sendMagicLink = async (email: string) => {
    setError(null);
    try {
      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      if (!supabase) throw new Error("Supabase 未配置");
      const { error } = await (supabase as any).auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      setEmailPending(email);
    } catch (e: any) {
      setError(e?.message || String(e));
      throw e;
    }
  };

  const signOut = async () => {
    setError(null);
    if (!supabase) return;
    await (supabase as any).auth.signOut();
  };

  const value: AuthContextValue = {
    user,
    loading,
    error,
    requestEmailOtp,
    verifyEmailOtp,
    sendMagicLink,
    signOut,
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
