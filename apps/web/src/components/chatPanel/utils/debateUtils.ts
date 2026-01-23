export function buildDebatePrefix(
  stance: NonNullable<{ debate_stance: string }["debate_stance"]>,
  kind: NonNullable<{ debate_kind: string }["debate_kind"]>
) {
  return `[debate:stance=${stance};kind=${kind}]`;
}

export function parseDebatePrefs(raw: string | null) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<{
      debateMode: boolean;
      debateStance: string;
      debateKind: string;
      debateFilter: "all" | "debate" | "normal";
      partition: "chat" | "debate" | "forum";
      stanceFilter: "all" | "pro" | "con" | "uncertain";
      kindFilter: "all" | "claim" | "evidence" | "rebuttal" | "question" | "summary";
    }>;
    if (typeof obj !== "object" || obj === null) return null;
    const next: { [key: string]: any } = {};
    if (typeof obj.debateMode === "boolean") next.debateMode = obj.debateMode;
    if (
      obj.debateStance === "pro" ||
      obj.debateStance === "con" ||
      obj.debateStance === "uncertain"
    ) {
      next.debateStance = obj.debateStance;
    }
    if (
      obj.debateKind === "claim" ||
      obj.debateKind === "evidence" ||
      obj.debateKind === "rebuttal" ||
      obj.debateKind === "question" ||
      obj.debateKind === "summary"
    ) {
      next.debateKind = obj.debateKind;
    }
    if (obj.partition === "chat" || obj.partition === "debate") {
      next.partition = obj.partition;
    } else if (obj.partition === "forum") {
      next.partition = "forum";
    } else if (obj.debateFilter === "debate") {
      next.partition = "debate";
    } else if (obj.debateFilter === "normal" || obj.debateFilter === "all") {
      next.partition = "chat";
    }
    if (
      obj.stanceFilter === "all" ||
      obj.stanceFilter === "pro" ||
      obj.stanceFilter === "con" ||
      obj.stanceFilter === "uncertain"
    ) {
      next.stanceFilter = obj.stanceFilter;
    }
    if (
      obj.kindFilter === "all" ||
      obj.kindFilter === "claim" ||
      obj.kindFilter === "evidence" ||
      obj.kindFilter === "rebuttal" ||
      obj.kindFilter === "question" ||
      obj.kindFilter === "summary"
    ) {
      next.kindFilter = obj.kindFilter;
    }
    return next;
  } catch {
    return null;
  }
}
