"use client";

import React, { useState, use } from "react";
import { Coins, Heart, History, TrendingUp, Shield } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useTranslations } from "@/lib/i18n";
import type { TabConfig, TabType } from "../types";
import { useProfileAggregates } from "../hooks/useProfileAggregates";
import { ProfilePageView } from "../components/ProfilePageView";

type Props = {
  params: Promise<{ id: string }>;
};

export default function UserProfilePage({ params }: Props) {
  const resolvedParams = use(params);
  const address = resolvedParams.id;
  const { address: myAccount, disconnect } = useWallet();
  const { user: authUser } = useUser();
  const tProfile = useTranslations("profile");

  const [activeTab, setActiveTab] = useState<TabType>("predictions");

  const isOwnProfile = myAccount?.toLowerCase() === address?.toLowerCase();

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
    address,
    user: isOwnProfile ? authUser : null,
    profile: null,
    tProfile,
  });

  const tabs: TabConfig[] = [
    { id: "predictions", label: tProfile("sidebar.tabs.predictions"), icon: TrendingUp },
    { id: "makerEarnings", label: tProfile("sidebar.tabs.makerEarnings"), icon: Coins },
    { id: "history", label: tProfile("sidebar.tabs.history"), icon: History },
    { id: "following", label: tProfile("sidebar.tabs.following"), icon: Heart },
    ...(isOwnProfile
      ? [{ id: "security" as const, label: tProfile("sidebar.tabs.security"), icon: Shield }]
      : []),
  ];

  return (
    <ProfilePageView
      address={address}
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
      disconnect={isOwnProfile ? disconnect : () => {}}
      history={history}
      isOwnProfile={isOwnProfile}
    />
  );
}
