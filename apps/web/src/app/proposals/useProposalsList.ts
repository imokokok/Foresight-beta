import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  buildProposalsWithUserVotes,
  filterProposals,
  sortProposals,
  buildProposalCategories,
  type ProposalItem,
  type CategoryOption,
  type ProposalFilter,
  PROPOSALS_EVENT_ID,
} from "./proposalsListUtils";
import { useCategories } from "@/hooks/useQueries";
import { normalizeId } from "@/lib/ids";
import { reactQueryFeedback } from "@/lib/apiWithFeedback";
import { t } from "@/lib/i18n";

const fetchProposals = async (): Promise<ProposalItem[]> => {
  const res = await fetch(`/api/forum?eventId=${PROPOSALS_EVENT_ID}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data.threads || [];
};

export function useProposalsList(account: string | null | undefined, connectWallet: () => void) {
  const queryClient = useQueryClient();
  const { data: categoriesData } = useCategories();
  const [filter, setFilter] = useState<ProposalFilter>("hot");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [pendingVoteId, setPendingVoteId] = useState<number | null>(null);

  const voteFeedback = reactQueryFeedback({
    loadingMessage: t("common.loading"),
    successMessage: t("common.success"),
    errorMessage: t("forum.errors.voteFailed"),
  });

  const { data: proposals = [], isLoading } = useQuery<ProposalItem[]>({
    queryKey: ["proposals"],
    queryFn: fetchProposals,
  });

  const { data: userVotesData } = useQuery<any[]>({
    queryKey: ["proposalUserVotes", account],
    queryFn: async () => {
      const res = await fetch(`/api/forum/user-votes?eventId=${PROPOSALS_EVENT_ID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load votes");
      return Array.isArray(data.votes) ? data.votes : [];
    },
    enabled: !!account,
  });

  const userVotesMap: Record<number, "up" | "down"> = React.useMemo(() => {
    const map: Record<number, "up" | "down"> = {};
    (userVotesData || []).forEach((v: any) => {
      if (v?.content_type === "thread" && v?.content_id != null) {
        const idNum = normalizeId(v.content_id);
        if (idNum != null) {
          map[idNum] = String(v.vote_type) === "down" ? "down" : "up";
        }
      }
    });
    return map;
  }, [userVotesData]);

  const voteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: "up" | "down" }) => {
      if (!account) {
        connectWallet();
        throw new Error(t("forum.errors.walletRequiredForVote"));
      }
      const res = await fetch("/api/forum/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: PROPOSALS_EVENT_ID,
          type: "thread",
          id,
          dir: type,
          walletAddress: account,
        }),
      });
      if (!res.ok) throw new Error(t("forum.errors.voteFailed"));
      return res.json();
    },
    onMutate: ({ id }) => {
      voteFeedback.onMutate();
      setPendingVoteId(id);
    },
    onSuccess: () => {
      voteFeedback.onSuccess();
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      voteFeedback.onError(err);
    },
    onSettled: () => {
      setPendingVoteId(null);
    },
  });

  const proposalsWithUserVote = React.useMemo(
    () => buildProposalsWithUserVotes(proposals, userVotesMap),
    [proposals, userVotesMap]
  );

  const filteredProposals = React.useMemo(
    () =>
      filterProposals(proposalsWithUserVote, {
        category,
        search,
      }),
    [proposalsWithUserVote, category, search]
  );

  const sortedProposals = React.useMemo(
    () => sortProposals(filteredProposals, filter),
    [filteredProposals, filter]
  );
  const categories: CategoryOption[] = React.useMemo(
    () => buildProposalCategories(categoriesData),
    [categoriesData]
  );

  return {
    filter,
    setFilter,
    category,
    setCategory,
    search,
    setSearch,
    proposals,
    sortedProposals,
    categories,
    isLoading,
    voteMutation,
    pendingVoteId,
  };
}

export type UseProposalsListReturn = ReturnType<typeof useProposalsList>;
