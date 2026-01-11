"use client";

import React, { useState } from "react";
import { Coins, Heart, History, TrendingUp, Users } from "lucide-react";
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

  const [activeTab, setActiveTab] = useState<TabType>("predictions");

  const {
    history,
    username,
    positions,
    profileInfo,
    portfolioStats,
    positionsCount,
    historyLoading,
    portfolioLoading,
    portfolioError,
  } = useProfileAggregates({
    account,
    user,
    profile: profileCtx?.profile,
    tProfile,
  });

  const tabs: TabConfig[] = [
    { id: "predictions", label: tProfile("sidebar.tabs.predictions"), icon: TrendingUp },
    { id: "makerEarnings", label: tProfile("sidebar.tabs.makerEarnings"), icon: Coins },
    { id: "history", label: tProfile("sidebar.tabs.history"), icon: History },
    { id: "following", label: tProfile("sidebar.tabs.following"), icon: Heart },
    { id: "followers", label: tProfile("sidebar.stats.followers"), icon: Users },
  ];

  return (
    <ProfilePageView
      account={account}
      username={username}
      profileInfo={profileInfo}
      tProfile={tProfile}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      historyCount={history.length}
      positionsCount={positionsCount}
      portfolioStats={portfolioStats}
      positions={positions}
      historyLoading={historyLoading}
      portfolioLoading={portfolioLoading}
      portfolioError={portfolioError}
      disconnect={disconnect}
      history={history}
      isOwnProfile={true}
    />
  );
}
