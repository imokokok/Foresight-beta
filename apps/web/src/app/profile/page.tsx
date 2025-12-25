"use client";

import React, { useState } from "react";
import { Heart, History, TrendingUp, User } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useTranslations } from "@/lib/i18n";
import type { TabConfig, TabType } from "./types";
import { useProfileAggregates } from "./hooks/useProfileAggregates";
import { ProfilePageView } from "./components/ProfilePageView";

export default function ProfilePage() {
  const { account, disconnectWallet: disconnect } = useWallet();
  const { user } = useAuth();
  const profileCtx = useUserProfileOptional();
  const tProfile = useTranslations("profile");

  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const { history, username, portfolioStats, positionsCount, followingCount } =
    useProfileAggregates({
      account,
      user,
      profile: profileCtx?.profile,
      tProfile,
    });

  const tabs: TabConfig[] = [
    { id: "overview", label: tProfile("sidebar.tabs.overview"), icon: User },
    { id: "predictions", label: tProfile("sidebar.tabs.predictions"), icon: TrendingUp },
    { id: "history", label: tProfile("sidebar.tabs.history"), icon: History },
    { id: "following", label: tProfile("sidebar.tabs.following"), icon: Heart },
  ];

  return (
    <ProfilePageView
      account={account}
      username={username}
      tProfile={tProfile}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      historyCount={history.length}
      positionsCount={positionsCount}
      followingCount={followingCount}
      portfolioStats={portfolioStats}
      disconnect={disconnect}
      history={history}
    />
  );
}
