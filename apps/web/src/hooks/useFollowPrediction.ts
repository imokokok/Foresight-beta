import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { getFollowStatus, toggleFollowPrediction } from "@/lib/follows";

export interface UseFollowPredictionResult {
  following: boolean;
  followersCount: number;
  followLoading: boolean;
  followError: string | null;
  toggleFollow: () => Promise<void>;
}

export function useFollowPrediction(
  predictionId?: number,
  walletAddress?: string
): UseFollowPredictionResult {
  const tErrors = useTranslations("errors");
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    if (!predictionId || !walletAddress) return;

    let cancelled = false;

    const load = async () => {
      try {
        const status = await getFollowStatus(predictionId, walletAddress);
        if (cancelled) return;
        setFollowing(status.following);
        setFollowersCount(status.followersCount);
        setFollowError(null);
      } catch (e: any) {
        if (cancelled) return;
        setFollowError(tErrors("loadFailed"));
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [predictionId, walletAddress]);

  const toggleFollow = useCallback(async () => {
    if (!predictionId || !walletAddress) return;

    setFollowLoading(true);
    setFollowError(null);

    try {
      const newStatus = await toggleFollowPrediction(following, predictionId, walletAddress);
      setFollowing(newStatus);
      setFollowersCount((prev) => {
        const next = newStatus ? prev + 1 : prev - 1;
        return next < 0 ? 0 : next;
      });
    } catch (e: any) {
      setFollowError(tErrors("followActionFailed"));
    } finally {
      setFollowLoading(false);
    }
  }, [predictionId, walletAddress, following]);

  return { following, followersCount, followLoading, followError, toggleFollow };
}
