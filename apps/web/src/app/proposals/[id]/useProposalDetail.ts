import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { normalizePositiveId, isValidPositiveId } from "@/lib/ids";
import { toast } from "@/lib/toast";
import { fetchUsernamesByAddresses, getDisplayName } from "@/lib/userProfiles";
import { t } from "@/lib/i18n";
import { PROPOSALS_EVENT_ID, type ProposalItem, type ProposalComment } from "../proposalsListUtils";

export type CommentView = ProposalComment;

export interface ThreadView extends ProposalItem {
  comments?: CommentView[] | null;
  subject_name?: string;
  action_verb?: string;
  target_value?: string;
  deadline?: string;
}

export function useProposalDetail(id: string) {
  const { account, formatAddress } = useWallet();
  const idNum = normalizePositiveId(id);
  const isValidId = isValidPositiveId(idNum);

  const [thread, setThread] = useState<ThreadView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [userVoteTypes, setUserVoteTypes] = useState<Record<string, "up" | "down">>({});
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  // Fetch thread data
  const fetchThread = useCallback(async () => {
    if (!isValidId || !idNum) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/forum?eventId=${PROPOSALS_EVENT_ID}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to load proposal");
      }
      const list = Array.isArray(data?.threads) ? data.threads : [];
      const found = list.find((t: any) => normalizePositiveId(String(t.id)) === idNum) || null;

      if (!found) {
        setError("Proposal not found");
      } else {
        setThread(found);
        // Collect addresses for username fetching
        const addresses = new Set<string>();
        if (found.user_id) addresses.add(found.user_id);
        if (Array.isArray(found.comments)) {
          found.comments.forEach((c: any) => {
            if (c.user_id) addresses.add(c.user_id);
          });
        }
        if (addresses.size > 0) {
          fetchUsernamesByAddresses(Array.from(addresses)).then((map) => {
            setNameMap((prev) => ({ ...prev, ...map }));
          });
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load proposal");
    } finally {
      setLoading(false);
    }
  }, [idNum, isValidId]);

  // Fetch user votes
  const fetchUserVotes = useCallback(async () => {
    if (!account) {
      setUserVotes(new Set());
      setUserVoteTypes({});
      return;
    }
    try {
      const res = await fetch(`/api/forum/user-votes?eventId=${PROPOSALS_EVENT_ID}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.votes)) {
        const set = new Set<string>();
        const types: Record<string, "up" | "down"> = {};
        data.votes.forEach((v: any) => {
          const key = `${v.content_type}:${v.content_id}`;
          set.add(key);
          types[key] = String(v.vote_type) === "down" ? "down" : "up";
        });
        setUserVotes(set);
        setUserVoteTypes(types);
      }
    } catch (e) {
      console.error("Failed to fetch user votes", e);
    }
  }, [account]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  useEffect(() => {
    fetchUserVotes();
  }, [fetchUserVotes]);

  const vote = async (type: "thread" | "comment", contentId: number, dir: "up" | "down") => {
    if (!account) {
      toast.error(t("forum.errors.walletRequiredForVote"));
      return;
    }
    const key = `${type}:${contentId}`;
    if (userVotes.has(key)) {
      toast.error(t("forum.errors.alreadyVoted"));
      return;
    }

    // Optimistic update
    setUserVotes((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setUserVoteTypes((prev) => ({ ...prev, [key]: dir }));

    if (type === "thread" && thread) {
      setThread((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          upvotes: dir === "up" ? (prev.upvotes || 0) + 1 : prev.upvotes,
          downvotes: dir === "down" ? (prev.downvotes || 0) + 1 : prev.downvotes,
        };
      });
    } else if (type === "comment" && thread) {
      setThread((prev) => {
        if (!prev) return null;
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
        const data = await res.json();
        throw new Error(data.message || "Vote failed");
      }
    } catch (e: any) {
      toast.error(t("forum.errors.voteFailed"), e.message);
      // Revert optimistic update
      fetchThread();
      fetchUserVotes();
    }
  };

  const postComment = async (content: string, parentId?: number) => {
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
        const data = await res.json();
        throw new Error(data.message || t("forum.errors.commentFailed"));
      }
      toast.success(t("forum.reply.commentPosted"));
      fetchThread(); // Refresh thread to get new comment
    } catch (e: any) {
      toast.error(t("forum.errors.commentFailed"), e.message);
    }
  };

  const stats = useMemo(() => {
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
  }, [thread]);

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
    refresh: fetchThread,
    displayName,
  };
}
