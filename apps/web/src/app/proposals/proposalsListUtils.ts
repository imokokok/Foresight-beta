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
  userVote?: "up" | "down";
};

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
  const items =
    categoriesData.map((item: any) => {
      const name = String(item?.name || "").trim();
      if (!name || seen.has(name)) {
        return null;
      }
      seen.add(name);
      let icon: any = Hash;
      if (name === "General") icon = MessageCircle;
      else if (name === "Tech") icon = Zap;
      else if (name === "Business") icon = Target;
      else if (name === "Crypto") icon = Sparkles;
      else if (name === "Sports") icon = Trophy;
      else if (name === "Politics") icon = Shield;
      return { id: name, label: name, icon };
    }) || [];
  return base.concat(items.filter((x): x is CategoryOption => !!x));
}
