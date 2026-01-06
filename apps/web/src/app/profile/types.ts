import type React from "react";

export type TabType = "predictions" | "history" | "following" | "followers" | "makerEarnings";

export type PortfolioStats = {
  total_invested: number;
  active_count: number;
  win_rate: string;
  realized_pnl?: number;
};

export type TabConfig = {
  id: TabType;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};
