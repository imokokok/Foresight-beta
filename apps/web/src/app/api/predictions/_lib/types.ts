import type { Database } from "@/lib/supabase";

export type PredictionRow = Database["public"]["Tables"]["predictions"]["Row"];
export type EventFollowRow = Database["public"]["Tables"]["event_follows"]["Row"];

export type PredictionStats = {
  yesAmount: number;
  noAmount: number;
  totalAmount: number;
  participantCount: number;
  yesProbability: number;
  noProbability: number;
  betCount: number;
};

export type PredictionListItem = PredictionRow & {
  followers_count: number;
  stats: PredictionStats;
};
