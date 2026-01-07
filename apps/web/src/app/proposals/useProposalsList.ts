import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  buildProposalsWithUserVotes,
  filterProposals,
  sortProposals,
  buildProposalCategories,
  fetchProposalsList,
  fetchProposalUserVotes,
  type ProposalItem,
  type CategoryOption,
  type ProposalFilter,
  PROPOSALS_EVENT_ID,
  PROPOSAL_USER_VOTES_STALE_MS,
  proposalsQueryKeys,
  type ProposalUserVoteRow,
} from "./proposalsListUtils";
import { useCategories } from "@/hooks/useQueries";
import { normalizeId } from "@/lib/ids";
import { reactQueryFeedback } from "@/lib/apiWithFeedback";
import { t } from "@/lib/i18n";

function useProposalUserVotes(walletAddress: string | null | undefined) {
  const { data: userVotesData } = useQuery<ProposalUserVoteRow[]>({
    queryKey: proposalsQueryKeys.userVotes(walletAddress),
    queryFn: fetchProposalUserVotes,
    enabled: !!walletAddress,
    staleTime: PROPOSAL_USER_VOTES_STALE_MS,
  });

  const userVotesMap: Record<number, "up" | "down"> = React.useMemo(() => {
    const map: Record<number, "up" | "down"> = {};
    (userVotesData || []).forEach((v) => {
      if (v?.content_type === "thread" && v?.content_id != null) {
        const idNum = normalizeId(v.content_id);
        if (idNum != null) {
          map[idNum] = String(v.vote_type) === "down" ? "down" : "up";
        }
      }
    });
    return map;
  }, [userVotesData]);

  return { userVotesMap };
}

function useProposalVoteMutation(options: {
  walletAddress: string | null | undefined;
  onRequireWallet: () => void;
}) {
  const queryClient = useQueryClient();
  const [pendingVoteId, setPendingVoteId] = useState<number | null>(null);

  const voteFeedback = reactQueryFeedback({
    loadingMessage: t("common.loading"),
    successMessage: t("common.success"),
    errorMessage: t("forum.errors.voteFailed"),
  });

  const voteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: "up" | "down" }) => {
      if (!options.walletAddress) {
        options.onRequireWallet();
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
          walletAddress: options.walletAddress,
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
      queryClient.invalidateQueries({ queryKey: proposalsQueryKeys.list() });
    },
    onError: (error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      voteFeedback.onError(err);
    },
    onSettled: () => {
      setPendingVoteId(null);
    },
  });

  return { voteMutation, pendingVoteId };
}

export function useProposalsListCore() {
  const queryClient = useQueryClient();
  const { data: categoriesData } = useCategories();
  const [filter, setFilter] = useState<ProposalFilter>("hot");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const { data: proposals = [], isLoading } = useQuery<ProposalItem[]>({
    queryKey: proposalsQueryKeys.list(),
    queryFn: fetchProposalsList,
  });

  const categories: CategoryOption[] = React.useMemo(
    () => buildProposalCategories(categoriesData),
    [categoriesData]
  );

  const onProposalCreated = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: proposalsQueryKeys.list() });
    setFilter("new");
  }, [queryClient]);

  return {
    filter,
    setFilter,
    category,
    setCategory,
    search,
    setSearch,
    proposals,
    categories,
    isLoading,
    onProposalCreated,
  };
}

export function useProposalsList(
  walletAddress: string | null | undefined,
  onRequireWallet: () => void
) {
  const core = useProposalsListCore();
  const { userVotesMap } = useProposalUserVotes(walletAddress);
  const { voteMutation, pendingVoteId } = useProposalVoteMutation({
    walletAddress,
    onRequireWallet,
  });

  const proposalsWithUserVote = React.useMemo(
    () => buildProposalsWithUserVotes(core.proposals, userVotesMap),
    [core.proposals, userVotesMap]
  );

  const filteredProposals = React.useMemo(
    () =>
      filterProposals(proposalsWithUserVote, {
        category: core.category,
        search: core.search,
      }),
    [proposalsWithUserVote, core.category, core.search]
  );

  const sortedProposals = React.useMemo(
    () => sortProposals(filteredProposals, core.filter),
    [filteredProposals, core.filter]
  );

  return {
    ...core,
    sortedProposals,
    voteMutation,
    pendingVoteId,
  };
}

export type UseProposalsListReturn = ReturnType<typeof useProposalsList>;
