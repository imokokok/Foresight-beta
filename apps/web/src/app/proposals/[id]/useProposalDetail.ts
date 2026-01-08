import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/contexts/WalletContext";
import { normalizePositiveId, isValidPositiveId } from "@/lib/ids";
import { toast, handleApiError } from "@/lib/toast";
import { fetchUsernamesByAddresses, getDisplayName } from "@/lib/userProfiles";
import { t } from "@/lib/i18n";
import {
  PROPOSALS_EVENT_ID,
  PROPOSAL_DETAIL_STALE_MS,
  PROPOSAL_USER_VOTES_STALE_MS,
  proposalsQueryKeys,
  fetchProposalUserVotes,
  type ProposalItem,
  type ProposalComment,
  type ProposalUserVoteRow,
} from "../proposalsListUtils";

export type CommentView = ProposalComment;

export interface ThreadView extends ProposalItem {
  comments?: CommentView[] | null;
  subject_name?: string;
  action_verb?: string;
  target_value?: string;
  deadline?: string;
}

function buildUserVoteState(userVotesData: ProposalUserVoteRow[] | undefined) {
  const set = new Set<string>();
  const types: Record<string, "up" | "down"> = {};
  (userVotesData || []).forEach((v) => {
    const key = `${v.content_type}:${v.content_id}`;
    set.add(key);
    types[key] = String(v.vote_type) === "down" ? "down" : "up";
  });
  return { userVotes: set, userVoteTypes: types };
}

function computeThreadStats(thread: ThreadView | null) {
  if (!thread) {
    return { commentsCount: 0, upvotes: 0, downvotes: 0, totalVotes: 0 };
  }
  const upvotes = Number(thread.upvotes || 0);
  const downvotes = Number(thread.downvotes || 0);
  return {
    commentsCount: Array.isArray(thread.comments) ? thread.comments.length : 0,
    upvotes,
    downvotes,
    totalVotes: upvotes + downvotes,
  };
}

async function fetchProposalThreadById(idNum: number | null): Promise<ThreadView | null> {
  if (!idNum) return null;
  const res = await fetch(`/api/forum?eventId=${PROPOSALS_EVENT_ID}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || "Failed to load proposal");
  }
  const list = Array.isArray(data?.threads) ? data.threads : [];
  const found = list.find((t: any) => normalizePositiveId(String(t.id)) === idNum) || null;
  return found as ThreadView | null;
}

export function useProposalDetail(id: string) {
  const { account, formatAddress } = useWallet();
  const idNum = normalizePositiveId(id);
  const isValidId = isValidPositiveId(idNum);

  const queryClient = useQueryClient();

  const {
    data: threadData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<ThreadView | null>({
    queryKey: proposalsQueryKeys.detail(idNum),
    queryFn: () => fetchProposalThreadById(idNum),
    enabled: isValidId && !!idNum,
    initialData: () => {
      if (!isValidId || !idNum) return null;
      const list = queryClient.getQueryData<ProposalItem[] | undefined>(proposalsQueryKeys.list());
      if (!Array.isArray(list)) return null;
      const found = list.find((t) => normalizePositiveId(String((t as any).id)) === idNum) || null;
      return found as ThreadView | null;
    },
    staleTime: PROPOSAL_DETAIL_STALE_MS,
  });

  const thread = threadData || null;
  const loading = isLoading;
  const error =
    queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    return refetch();
  }, [refetch]);

  const { data: userVotesData = [] } = useQuery<ProposalUserVoteRow[]>({
    queryKey: proposalsQueryKeys.userVotes(account),
    queryFn: fetchProposalUserVotes,
    enabled: !!account,
    staleTime: PROPOSAL_USER_VOTES_STALE_MS,
  });

  const { userVotes, userVoteTypes } = useMemo(() => {
    return buildUserVoteState(userVotesData);
  }, [userVotesData]);

  useEffect(() => {
    if (!thread) return;
    const addresses = new Set<string>();
    if (thread.user_id) addresses.add(thread.user_id);
    if (Array.isArray(thread.comments)) {
      thread.comments.forEach((c: any) => {
        if (c.user_id) addresses.add(c.user_id);
      });
    }
    if (addresses.size === 0) return;
    fetchUsernamesByAddresses(Array.from(addresses)).then((map) => {
      setNameMap((prev) => ({ ...prev, ...map }));
    });
  }, [thread]);

  const vote = useCallback(
    async (type: "thread" | "comment", contentId: number, dir: "up" | "down") => {
      if (!account) {
        toast.error(t("forum.errors.walletRequiredForVote"));
        return;
      }
      const key = `${type}:${contentId}`;
      if (userVotes.has(key)) {
        toast.error(t("forum.errors.alreadyVoted"));
        return;
      }

      queryClient.setQueryData<ProposalUserVoteRow[]>(
        proposalsQueryKeys.userVotes(account),
        (prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          list.push({ content_type: type, content_id: contentId, vote_type: dir });
          return list;
        }
      );

      if (type === "thread" && thread) {
        queryClient.setQueryData<ThreadView | null>(proposalsQueryKeys.detail(idNum), (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            upvotes: dir === "up" ? (prev.upvotes || 0) + 1 : prev.upvotes,
            downvotes: dir === "down" ? (prev.downvotes || 0) + 1 : prev.downvotes,
          };
        });
      } else if (type === "comment" && thread) {
        queryClient.setQueryData<ThreadView | null>(proposalsQueryKeys.detail(idNum), (prev) => {
          if (!prev) return prev;
          const nextComments = (prev.comments || []).map((c) => {
            if (c.id === contentId) {
              return {
                ...c,
                upvotes: dir === "up" ? (c.upvotes || 0) + 1 : c.upvotes,
                downvotes: dir === "down" ? (c.downvotes || 0) + 1 : c.downvotes,
              };
            }
            return c;
          });
          return { ...prev, comments: nextComments };
        });
      }

      try {
        const res = await fetch("/api/forum/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, id: contentId, dir }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const payload =
            data && typeof data === "object"
              ? { status: res.status, ...data }
              : { status: res.status };
          throw payload;
        }
      } catch (e: any) {
        handleApiError(e, "forum.errors.voteFailed");
        refresh();
        queryClient.invalidateQueries({ queryKey: proposalsQueryKeys.userVotes(account) });
      }
    },
    [account, userVotes, queryClient, thread, idNum, refresh]
  );

  const postComment = useCallback(
    async (content: string, parentId?: number) => {
      if (!account || !thread) return;
      try {
        const res = await fetch("/api/forum/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: PROPOSALS_EVENT_ID,
            threadId: thread.id,
            content,
            walletAddress: account,
            parentId,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const payload =
            data && typeof data === "object"
              ? { status: res.status, ...data }
              : { status: res.status };
          throw payload;
        }
        toast.success(t("forum.reply.commentPosted"));
        refresh();
      } catch (e: any) {
        handleApiError(e, "forum.errors.commentFailed");
      }
    },
    [account, thread, refresh]
  );

  const isAuthor = !!account && !!thread && String(thread.user_id || "") === String(account || "");

  const canResubmit =
    !!thread && isAuthor && String(thread.review_status || "") === "needs_changes";

  const resubmit = useCallback(async () => {
    if (!thread || !canResubmit) return;
    try {
      const res = await fetch(`/api/review/proposals/${thread.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resubmit" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const payload =
          data && typeof data === "object"
            ? { status: res.status, ...data }
            : { status: res.status };
        throw payload;
      }
      toast.success(t("proposals.detail.resubmitSuccess"));
      refresh();
    } catch (e: any) {
      handleApiError(e, "proposals.detail.resubmitFailed");
    }
  }, [thread, canResubmit, refresh]);

  const stats = useMemo(() => computeThreadStats(thread), [thread]);

  const displayName = useCallback(
    (addr: string) => {
      return getDisplayName(addr, nameMap, formatAddress);
    },
    [nameMap, formatAddress]
  );

  return {
    thread,
    loading,
    error,
    isValidId,
    userVotes,
    userVoteTypes,
    vote,
    postComment,
    stats,
    refresh,
    displayName,
    canResubmit,
    resubmit,
  };
}
