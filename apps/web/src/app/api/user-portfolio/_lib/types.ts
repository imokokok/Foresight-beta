export type BetRow = {
  id: string | number;
  prediction_id: number;
  amount: number;
  outcome: string;
  created_at: string;
};

export type PredictionMeta = {
  title: string;
  image_url: string | null;
  status: string;
  deadline?: string | null;
  min_stake: number;
  winning_outcome: string | null;
};

export type PredictionStats = {
  yesAmount: number;
  noAmount: number;
  totalAmount: number;
  participantCount: number;
  betCount: number;
};

export type PositionView = {
  id: number;
  title: string;
  image_url: string;
  status: string;
  deadline?: string | null;
  stake: number;
  outcome: string;
  pnl: string;
  joined_at: string;
  stats: {
    yesAmount: number;
    noAmount: number;
    totalAmount: number;
    participantCount: number;
    betCount: number;
    yesProbability: number;
    noProbability: number;
  };
};

export type PortfolioStatsResponse = {
  total_invested: number;
  active_count: number;
  win_rate: string;
  realized_pnl: number;
};

export type PortfolioResponse = {
  positions: PositionView[];
  stats: PortfolioStatsResponse;
};
