import { normalizeId } from "@/lib/ids";
import type { ThreadView } from "./types";

export async function fetchThreads(eventId: number, threadId: number | undefined) {
  const res = await fetch(`/api/forum?eventId=${eventId}`);
  const data = await res.json();
  let list = Array.isArray(data?.threads) ? data.threads : [];
  if (threadId != null) {
    const idNum = normalizeId(threadId);
    if (idNum != null) {
      list = list.filter((t: any) => normalizeId(t.id) === idNum);
    }
  }
  return list as ThreadView[];
}

export async function fetchUserVotes(eventId: number) {
  const res = await fetch(`/api/forum/user-votes?eventId=${eventId}`);
  const j = await res.json();
  const set = new Set<string>();
  const types: Record<string, "up" | "down"> = {};
  (Array.isArray(j?.votes) ? j.votes : []).forEach((v: any) => {
    const key = `${String(v.content_type)}:${String(v.content_id)}`;
    set.add(key);
    const vt = String(v.vote_type) === "down" ? "down" : "up";
    types[key] = vt;
  });
  return { set, types };
}

export async function createThread(payload: {
  eventId: number;
  title: string;
  walletAddress: string;
  subjectName: string;
  actionVerb: "priceReach" | "willWin" | "willHappen";
  targetValue: string;
  category:
    | "tech"
    | "entertainment"
    | "politics"
    | "weather"
    | "sports"
    | "business"
    | "crypto"
    | "more";
  deadline: string;
  titlePreview: string;
  criteriaPreview: string;
}) {
  const res = await fetch("/api/forum", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: payload.eventId,
      title: payload.title,
      content: "",
      walletAddress: payload.walletAddress,
      subjectName: payload.subjectName,
      actionVerb: payload.actionVerb,
      targetValue: payload.targetValue,
      category: payload.category,
      deadline: payload.deadline,
      titlePreview: payload.titlePreview,
      criteriaPreview: payload.criteriaPreview,
    }),
  });
  if (!res.ok) throw new Error("");
}

export async function createComment(input: {
  eventId: number;
  threadId: number;
  content: string;
  walletAddress: string;
  parentId?: number | null;
}) {
  const res = await fetch("/api/forum/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: input.eventId,
      threadId: input.threadId,
      content: input.content,
      walletAddress: input.walletAddress,
      parentId: input.parentId,
    }),
  });
  if (!res.ok) throw new Error("");
}

export async function sendVote(input: {
  type: "thread" | "comment";
  id: number;
  dir: "up" | "down";
}) {
  const res = await fetch("/api/forum/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("");
  }
}
