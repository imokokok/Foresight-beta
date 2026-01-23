import { useEffect, useState, useCallback } from "react";
import { parseDebatePrefs } from "../utils/debateUtils";

type DebatePreferences = {
  debateMode: boolean;
  debateStance: "pro" | "con" | "uncertain";
  debateKind: "claim" | "evidence" | "rebuttal" | "question" | "summary";
  partition: "chat" | "debate" | "forum";
  stanceFilter: "all" | "pro" | "con" | "uncertain";
  kindFilter: "all" | "claim" | "evidence" | "rebuttal" | "question" | "summary";
};

export function useDebatePreferences(eventId: number | string) {
  const [debateMode, setDebateMode] = useState(false);
  const [debateStance, setDebateStance] = useState<"pro" | "con" | "uncertain">("pro");
  const [debateKind, setDebateKind] = useState<
    "claim" | "evidence" | "rebuttal" | "question" | "summary"
  >("claim");
  const [partition, setPartition] = useState<"chat" | "debate" | "forum">("chat");
  const [stanceFilter, setStanceFilter] = useState<"all" | "pro" | "con" | "uncertain">("all");
  const [kindFilter, setKindFilter] = useState<
    "all" | "claim" | "evidence" | "rebuttal" | "question" | "summary"
  >("all");

  // 从localStorage加载辩论偏好设置
  useEffect(() => {
    const key = `chat:debatePrefs:${eventId}`;
    const prefs = parseDebatePrefs(
      typeof window !== "undefined" ? window.localStorage.getItem(key) : null
    );
    if (!prefs) return;
    if (prefs.debateMode !== undefined) setDebateMode(prefs.debateMode);
    if (prefs.debateStance) setDebateStance(prefs.debateStance);
    if (prefs.debateKind) setDebateKind(prefs.debateKind);
    if (prefs.partition) setPartition(prefs.partition);
    if (prefs.stanceFilter) setStanceFilter(prefs.stanceFilter);
    if (prefs.kindFilter) setKindFilter(prefs.kindFilter);
  }, [eventId]);

  // 保存辩论偏好设置到localStorage
  const savePreferences = useCallback(() => {
    const key = `chat:debatePrefs:${eventId}`;
    const preferences = {
      debateMode,
      debateStance,
      debateKind,
      partition,
      stanceFilter,
      kindFilter,
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(preferences));
    }
  }, [eventId, debateMode, debateStance, debateKind, partition, stanceFilter, kindFilter]);

  // 当分区改变时自动更新辩论模式
  useEffect(() => {
    if (partition === "debate") {
      setDebateMode(true);
    } else {
      setDebateMode(false);
    }
  }, [partition]);

  // 当任何偏好设置改变时保存到localStorage
  useEffect(() => {
    savePreferences();
  }, [savePreferences]);

  return {
    debateMode,
    setDebateMode,
    debateStance,
    setDebateStance,
    debateKind,
    setDebateKind,
    partition,
    setPartition,
    stanceFilter,
    setStanceFilter,
    kindFilter,
    setKindFilter,
  };
}
