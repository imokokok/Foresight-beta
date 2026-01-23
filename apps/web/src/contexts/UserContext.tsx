"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface UserProfile {
  id: string;
  email: string | null;
  username: string | null;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserContextValue {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

export const UserContext = createContext<UserContextValue | undefined>(undefined);

interface ProfileResponse {
  profile?: {
    email?: string;
    username?: string;
  } | null;
}

async function fetchApiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as { success: boolean; data?: T; error?: { message?: string } } | null;

  if (!res.ok || !json || !json.success) {
    const msg = json?.error?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return (json as { success: boolean; data: T }).data || (json as T);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetch("/api/auth/me", { method: "GET" });
      if (!me.ok) {
        setUser(null);
        return;
      }
      const meJson = (await me.json().catch(() => null)) as Record<string, unknown> | null;
      const address = typeof meJson?.address === "string" ? String(meJson.address) : "";
      if (!address) {
        setUser(null);
        return;
      }
      const profile = await fetchApiJson<ProfileResponse>(
        `/api/user-profiles?address=${encodeURIComponent(address)}`,
        { method: "GET" }
      ).catch(() => null);

      const email =
        profile && profile.profile && typeof profile.profile.email === "string"
          ? String(profile.profile.email)
          : null;
      const username =
        profile && profile.profile && typeof profile.profile.username === "string"
          ? String(profile.profile.username)
          : null;

      setUser({
        id: address,
        email,
        username,
        createdAt: "",
        updatedAt: "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    setError(null);
    try {
      const currentUser = user;
      if (!currentUser) {
        throw new Error("Not authenticated");
      }
      const updatedUser = { ...currentUser, ...data };
      setUser(updatedUser);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
      throw e;
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const value: UserContextValue = {
    user,
    loading,
    error,
    refreshUser,
    updateProfile,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

export function useUserOptional() {
  return useContext(UserContext);
}
