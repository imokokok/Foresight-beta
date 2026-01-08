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
import { useUserProfileInfo } from "@/hooks/useQueries";

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
  const { normalizedAccount } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const address = normalizedAccount || null;
  const profileQuery = useUserProfileInfo(address);

  useEffect(() => {
    if (!address) {
      setProfile(null);
      setError(null);
      return;
    }
    if (profileQuery.isError) {
      const e = profileQuery.error as any;
      setError(e?.message || String(e));
      setProfile(null);
      return;
    }
    if (profileQuery.data) {
      setProfile(profileQuery.data.profile ?? null);
      setError(null);
    }
  }, [address, profileQuery.data, profileQuery.isError, profileQuery.error]);

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
