import type React from "react";

export type TabType =
  | "predictions"
  | "history"
  | "following"
  | "followers"
  | "makerEarnings"
  | "security";

export type PortfolioStats = {
  total_invested: number;
  active_count: number;
  win_rate: string;
  realized_pnl?: number;
};

export type ProfilePosition = {
  id: string | number;
  title?: string;
  image_url?: string | null;
  outcome?: string;
  stake?: number | string;
  pnl?: string;
  status?: string;
  deadline?: string | null;
  stats?: {
    yesProbability?: number;
    noProbability?: number;
    totalAmount?: number;
    participantCount?: number;
  };
};

export type ProfileHistoryItem = {
  id: string | number;
  title?: string;
  image_url?: string | null;
  category?: string | null;
  viewed_at?: string | number;
};

export type ProfileUserSummary = {
  wallet_address: string;
  username: string;
  avatar: string;
};

export type TabConfig = {
  id: TabType;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};
