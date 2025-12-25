"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { fetchUsernamesByAddresses, getDisplayName } from "@/lib/userProfiles";
import { useTranslations } from "@/lib/i18n";
import {
  createComment,
  createThread,
  fetchThreads,
  fetchUserVotes,
  sendVote,
} from "./forumSection/api";
import { ForumSectionView } from "./forumSection/ForumSectionView";
import type {
  ActionVerb,
  ForumCategory,
  ForumSectionProps,
  ThreadView,
} from "./forumSection/types";

export default function ForumSection({ eventId, threadId, hideCreate }: ForumSectionProps) {
  const {
    account,
    connectWallet,
    formatAddress,
    siweLogin,
    requestWalletPermissions,
    multisigSign,
  } = useWallet();
  const tForum = useTranslations("forum");

  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const [subjectName, setSubjectName] = useState("");
  const [actionVerb, setActionVerb] = useState<ActionVerb>("priceReach");
  const [targetValue, setTargetValue] = useState("");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState<ForumCategory>("tech");

  const titlePreview = useMemo(() => {
    const name = String(subjectName || "").trim();
    const act = String(actionVerb || "").trim();
    const target = String(targetValue || "").trim();
    const dl = String(deadline || "").trim();
    if (!name || !act || !target || !dl) return "";
    const when = new Date(dl);
    const iso = when.toISOString().replace(".000Z", "Z");
    let key = "preview.title.default";
    if (act === "priceReach") key = "preview.title.priceReach";
    else if (act === "willWin") key = "preview.title.willWin";
    else if (act === "willHappen") key = "preview.title.willHappen";
    const template = tForum(key);
    return template
      .replace("{subjectName}", name)
      .replace("{deadline}", iso)
      .replace("{target}", target)
      .replace("{action}", act);
  }, [subjectName, actionVerb, targetValue, deadline, tForum]);

  const criteriaPreview = useMemo(() => {
    const act = String(actionVerb || "").trim();
    let key = "preview.criteria.default";
    if (act === "priceReach") key = "preview.criteria.priceReach";
    else if (act === "willWin") key = "preview.criteria.willWin";
    else if (act === "willHappen") key = "preview.criteria.willHappen";
    const template = tForum(key);
    return template.replace("{action}", act);
  }, [actionVerb, tForum]);

  const formError = useMemo(() => {
    const name = String(subjectName || "").trim();
    const target = String(targetValue || "").trim();
    const dl = String(deadline || "").trim();
    const cat = String(category || "").trim();
    if (!name) return tForum("form.errors.subjectRequired");
    if (!target) return tForum("form.errors.targetRequired");
    if (!dl) return tForum("form.errors.deadlineRequired");
    const d = new Date(dl);
    if (Number.isNaN(d.getTime())) return tForum("form.errors.deadlineInvalid");
    if (d.getTime() <= Date.now()) return tForum("form.errors.deadlinePast");
    if (!cat) return tForum("form.errors.categoryRequired");
    return "";
  }, [subjectName, targetValue, deadline, category, tForum]);

  const canSubmit = useMemo(() => !!titlePreview && !formError, [titlePreview, formError]);

  const displayName = (addr: string) => getDisplayName(addr, nameMap, formatAddress);
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [userVoteTypes, setUserVoteTypes] = useState<Record<string, "up" | "down">>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchThreads(eventId, threadId);
      setThreads(list);
    } catch (e: any) {
      setError(e?.message || tForum("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [eventId, threadId, tForum]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const fetchVotes = async () => {
      try {
        if (!account) {
          setUserVotes(new Set());
          return;
        }
        const { set, types } = await fetchUserVotes(eventId);
        setUserVotes(set);
        setUserVoteTypes(types);
      } catch {}
    };
    fetchVotes();
  }, [eventId, account]);

  useEffect(() => {
    const run = async () => {
      const addrs = new Set<string>();
      threads.forEach((t) => {
        if (t.user_id) addrs.add(String(t.user_id));
        (t.comments || []).forEach((c) => {
          if (c.user_id) addrs.add(String(c.user_id));
        });
      });
      if (account) addrs.add(String(account));
      const unknown = Array.from(addrs).filter((a) => !nameMap[String(a || "").toLowerCase()]);
      if (unknown.length === 0) return;
      const next = await fetchUsernamesByAddresses(unknown);
      if (Object.keys(next).length === 0) return;
      setNameMap((prev) => ({ ...prev, ...next }));
    };
    run();
  }, [threads, account, nameMap]);

  const postThread = async () => {
    if (!account) {
      setError(tForum("errors.walletRequired"));
      return;
    }
    const t = titlePreview;
    if (!t.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await createThread({
        eventId,
        title: t,
        walletAddress: account,
        subjectName,
        actionVerb,
        targetValue,
        category,
        deadline,
        titlePreview,
        criteriaPreview,
      });
      await load();
    } catch (e: any) {
      setError(e?.message || tForum("errors.createFailed"));
    } finally {
      setPosting(false);
    }
  };

  const postComment = async (threadIdNum: number, text: string, parentId?: number | null) => {
    if (!account) {
      setError(tForum("errors.walletRequired"));
      return;
    }
    if (!text.trim()) return;
    try {
      await createComment({
        eventId,
        threadId: threadIdNum,
        content: text,
        walletAddress: account,
        parentId,
      });
      await load();
    } catch (e: any) {
      setError(e?.message || tForum("errors.commentFailed"));
    }
  };

  const vote = async (type: "thread" | "comment", id: number, dir: "up" | "down") => {
    try {
      if (!account) {
        setError(tForum("errors.walletRequiredForVote"));
        return;
      }
      const key = `${type}:${id}`;
      if (userVotes.has(key)) {
        setError(tForum("errors.alreadyVoted"));
        return;
      }
      await sendVote({ type, id, dir });
      setUserVotes((prev) => new Set([...prev, key]));
      setUserVoteTypes((prev) => ({ ...prev, [key]: dir }));
      await load();
    } catch (e: any) {
      setError(e?.message || tForum("errors.voteFailed"));
    }
  };

  const handleConnectAndSign = async () => {
    await connectWallet();
    await requestWalletPermissions();
    await siweLogin();
    await multisigSign();
  };

  return (
    <ForumSectionView
      hideCreate={hideCreate}
      account={account}
      threads={threads}
      loading={loading}
      error={error}
      subjectName={subjectName}
      actionVerb={actionVerb}
      targetValue={targetValue}
      deadline={deadline}
      category={category}
      titlePreview={titlePreview}
      criteriaPreview={criteriaPreview}
      formError={formError}
      canSubmit={canSubmit}
      posting={posting}
      userVotes={userVotes}
      userVoteTypes={userVoteTypes}
      displayName={displayName}
      onConnectAndSign={handleConnectAndSign}
      onSubjectNameChange={setSubjectName}
      onActionVerbChange={setActionVerb}
      onTargetValueChange={setTargetValue}
      onDeadlineChange={setDeadline}
      onCategoryChange={setCategory}
      onPostThread={postThread}
      onVote={vote}
      onPostComment={postComment}
    />
  );
}
