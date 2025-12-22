"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useWallet } from "@/contexts/WalletContext";
import type { UserProfile } from "@/lib/supabase";

interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
}

export const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { account } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    const addr = String(account || "").toLowerCase();
    if (!addr) {
      setProfile(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user-profiles?address=${encodeURIComponent(addr)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      const p = data?.profile ?? null;
      setProfile(p);
    } catch (e: any) {
      setError(e?.message || String(e));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const value: UserProfileContextValue = {
    profile,
    loading,
    error,
    refreshProfile: fetchProfile,
    isAdmin: !!profile?.is_admin,
  };

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    throw new Error("useUserProfile must be used within UserProfileProvider");
  }
  return ctx;
}

export function useUserProfileOptional() {
  return useContext(UserProfileContext);
}
