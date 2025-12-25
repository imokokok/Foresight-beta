"use client";

import { useEffect, useState } from "react";
import type { PortfolioStats } from "../types";
import { MOCK_HISTORY } from "../mock";

export function useProfileAggregates(args: {
  account: string | null | undefined;
  user: any;
  profile: any;
  tProfile: (key: string) => string;
}) {
  const { account, user, profile, tProfile } = args;

  const [history, setHistory] = useState<any[]>([...MOCK_HISTORY]);
  const [username, setUsername] = useState("");
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);
  const [positionsCount, setPositionsCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    const loadHistory = async () => {
      if (!account) return;
      try {
        const res = await fetch(`/api/history?address=${account}`);
        const data = await res.json();
        if (data.history) setHistory(data.history);
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };

    const loadPortfolio = async () => {
      if (!account) return;
      try {
        const res = await fetch(`/api/user-portfolio?address=${account}`);
        const data = await res.json();
        if (Array.isArray(data.positions)) setPositionsCount(data.positions.length);
        if (data.stats) {
          setPortfolioStats({
            total_invested: Number(data.stats.total_invested || 0),
            active_count: Number(data.stats.active_count || 0),
            win_rate: String(data.stats.win_rate || "0%"),
            realized_pnl:
              data.stats.realized_pnl != null ? Number(data.stats.realized_pnl || 0) : undefined,
          });
        }
      } catch (e) {
        console.error("Failed to load portfolio", e);
      }
    };

    const loadFollowing = async () => {
      if (!account) return;
      try {
        const res = await fetch(`/api/following?address=${account}`);
        const data = await res.json();
        if (Array.isArray(data.following)) setFollowingCount(data.following.length);
      } catch (e) {
        console.error("Failed to load following", e);
      }
    };

    loadHistory();
    loadPortfolio();
    loadFollowing();
  }, [account]);

  useEffect(() => {
    if (!account) {
      setUsername(tProfile("username.anonymous"));
      return;
    }
    if (profile?.username) {
      setUsername(profile.username);
      return;
    }
    if (user?.user_metadata?.username) {
      setUsername(user.user_metadata.username);
      return;
    }
    if (user?.email) {
      setUsername(String(user.email).split("@")[0]);
      return;
    }
    setUsername(`User ${account.slice(0, 4)}`);
  }, [account, user, profile, tProfile]);

  return { history, setHistory, username, portfolioStats, positionsCount, followingCount };
}
