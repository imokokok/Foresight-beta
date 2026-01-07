import {
  LayoutGrid,
  MessageCircle,
  Zap,
  Target,
  Sparkles,
  Trophy,
  Shield,
  Hash,
  type LucideIcon,
} from "lucide-react";
import { TRENDING_CATEGORIES } from "@/features/trending/trendingModel";

export const PROPOSALS_EVENT_ID = 0;
export const PROPOSAL_DETAIL_STALE_MS = 15000;
export const PROPOSAL_USER_VOTES_STALE_MS = 30000;

export const proposalsQueryKeys = {
  list: () => ["proposals"] as const,
  detail: (id: number | null | undefined) => ["proposalDetail", id ?? null] as const,
  userVotes: (walletAddress: string | null | undefined) =>
    ["proposalUserVotes", walletAddress ?? null] as const,
};

export type ProposalFilter = "hot" | "new" | "top";

export type ProposalComment = {
  id: number;
  thread_id: number;
  event_id: number;
  user_id: string;
  content: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  parent_id: number | null;
};

export type ProposalItem = {
  id: number;
  event_id: number;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  created_prediction_id: number | null;
  comments?: ProposalComment[] | null;
  category?: string | null;
  review_status?: string | null;
  review_reason?: string | null;
  userVote?: "up" | "down";
};

export type ProposalUserVoteRow = {
  content_type?: string | null;
  content_id?: string | number | null;
  vote_type?: string | null;
};

export async function fetchProposalsList(): Promise<ProposalItem[]> {
  const res = await fetch(`/api/forum?eventId=${PROPOSALS_EVENT_ID}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message);
  return data?.threads || [];
}

export async function fetchProposalUserVotes(): Promise<ProposalUserVoteRow[]> {
  const res = await fetch(`/api/forum/user-votes?eventId=${PROPOSALS_EVENT_ID}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to load votes");
  return Array.isArray(data?.votes) ? (data.votes as ProposalUserVoteRow[]) : [];
}

export type CategoryOption = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export function buildProposalsWithUserVotes(
  proposals: ProposalItem[],
  userVotesMap: Record<number, "up" | "down">
): ProposalItem[] {
  return proposals.map((p) => ({
    ...p,
    userVote: userVotesMap[p.id] || p.userVote,
  }));
}

export function filterProposals(
  proposals: ProposalItem[],
  options: { category: string; search: string }
): ProposalItem[] {
  const category = options.category;
  const search = options.search;
  const q = search.trim().toLowerCase();
  return proposals.filter((p) => {
    const inCategory = category === "All" || p.category === category;
    if (!inCategory) return false;
    if (!q) return true;
    const title = String(p.title || "").toLowerCase();
    const content = String(p.content || "").toLowerCase();
    return title.includes(q) || content.includes(q);
  });
}

export function sortProposals(proposals: ProposalItem[], filter: ProposalFilter): ProposalItem[] {
  const list = [...proposals];
  if (filter === "hot") {
    return list.sort((a, b) => {
      const scoreA = (a.upvotes || 0) - (a.downvotes || 0) + (a.comments?.length || 0) * 2;
      const scoreB = (b.upvotes || 0) - (b.downvotes || 0) + (b.comments?.length || 0) * 2;
      return scoreB - scoreA;
    });
  }
  if (filter === "new") {
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (filter === "top") {
    return list.sort((a, b) => {
      const scoreA = (a.upvotes || 0) - (a.downvotes || 0);
      const scoreB = (b.upvotes || 0) - (b.downvotes || 0);
      return scoreB - scoreA;
    });
  }
  return list;
}

export function buildProposalCategories(categoriesData: any): CategoryOption[] {
  const base: CategoryOption[] = [{ id: "All", label: "Overview", icon: LayoutGrid }];
  if (!Array.isArray(categoriesData) || categoriesData.length === 0) {
    return base;
  }
  const seen = new Set<string>();
  const byName: Record<string, CategoryOption> = {};

  (categoriesData || []).forEach((item: any) => {
    const name = String(item?.name || "").trim();
    if (!name || seen.has(name)) {
      return;
    }
    seen.add(name);
    let icon: LucideIcon = Hash;
    if (name === "General") icon = MessageCircle;
    else if (name === "Tech" || name === "科技") icon = Zap;
    else if (name === "Business" || name === "商业") icon = Target;
    else if (name === "Crypto" || name === "加密货币") icon = Sparkles;
    else if (name === "Sports" || name === "体育") icon = Trophy;
    else if (name === "Politics" || name === "时政") icon = Shield;
    else if (name === "娱乐") icon = Sparkles;
    else if (name === "天气") icon = Target;
    else if (name === "更多") icon = Hash;

    byName[name] = { id: name, label: name, icon };
  });

  const orderedNames = TRENDING_CATEGORIES.map((cat) => cat.name);
  const ordered: CategoryOption[] = [];

  const hasMoreCategory = Object.prototype.hasOwnProperty.call(byName, "更多");

  orderedNames.forEach((name) => {
    const item = byName[name];
    if (item) {
      ordered.push(item);
      delete byName[name];
    }
  });

  const rest = hasMoreCategory
    ? []
    : Object.values(byName).sort((a, b) => a.label.localeCompare(b.label));

  return base.concat(ordered, rest);
}
