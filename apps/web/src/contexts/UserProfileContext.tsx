"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useWallet } from "@/contexts/WalletContext";
import type { Database } from "@/lib/database.types";
import { useUserProfileInfo } from "@/hooks/useQueries";
import { normalizeAddress } from "@/lib/address";

type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isReviewer: boolean;
}

export const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const normalizedAccount = address ? normalizeAddress(address) : undefined;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proxyEnsured, setProxyEnsured] = useState(false);

  const profileQuery = useUserProfileInfo(normalizedAccount);

  useEffect(() => {
    if (!address) {
      setProfile(null);
      setError(null);
      setProxyEnsured(false);
      return;
    }
    if (profileQuery.isError) {
      const e = profileQuery.error as any;
      setError(e?.message || String(e));
      setProfile(null);
      return;
    }
    if (profileQuery.data) {
      const p = profileQuery.data.profile ?? null;
      setProfile(p);
      setError(null);
      if (p && p.proxy_wallet_address) {
        setProxyEnsured(true);
      }
    }
  }, [address, profileQuery.data, profileQuery.isError, profileQuery.error]);

  useEffect(() => {
    if (!address) return;
    if (proxyEnsured) return;
    if (!profile || profile.proxy_wallet_address) return;

    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/wallets/proxy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) return;
        if (cancelled) return;
        await profileQuery.refetch();
      } catch {}
      if (!cancelled) {
        setProxyEnsured(true);
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [address, profile, proxyEnsured, profileQuery]);

  const refreshProfile = useCallback(async () => {
    await profileQuery.refetch();
  }, [profileQuery]);

  const value: UserProfileContextValue = {
    profile,
    loading: profileQuery.isLoading || profileQuery.isFetching,
    error,
    refreshProfile,
    isAdmin: !!profile?.is_admin,
    isReviewer: !!profile?.is_reviewer,
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
