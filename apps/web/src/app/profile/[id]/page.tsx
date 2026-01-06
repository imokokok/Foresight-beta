"use client";

import React, { useState, use } from "react";
import { Coins, Heart, History, TrendingUp } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
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
  const { account: myAccount, disconnectWallet: disconnect } = useWallet();
  const { user: authUser } = useAuth();
  const tProfile = useTranslations("profile");

  const [activeTab, setActiveTab] = useState<TabType>("predictions");

  const isOwnProfile = myAccount?.toLowerCase() === address?.toLowerCase();

  const { history, username, portfolioStats, positionsCount, followingCount } =
    useProfileAggregates({
      account: address,
      user: isOwnProfile ? authUser : null,
      profile: null,
      tProfile,
    });

  const tabs: TabConfig[] = [
    { id: "predictions", label: tProfile("sidebar.tabs.predictions"), icon: TrendingUp },
    { id: "makerEarnings", label: tProfile("sidebar.tabs.makerEarnings"), icon: Coins },
    { id: "history", label: tProfile("sidebar.tabs.history"), icon: History },
    { id: "following", label: tProfile("sidebar.tabs.following"), icon: Heart },
  ];

  return (
    <ProfilePageView
      account={address}
      username={username}
      tProfile={tProfile}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      historyCount={history.length}
      positionsCount={positionsCount}
      followingCount={followingCount}
      portfolioStats={portfolioStats}
      disconnect={isOwnProfile ? disconnect : () => {}}
      history={history}
      isOwnProfile={isOwnProfile}
    />
  );
}
