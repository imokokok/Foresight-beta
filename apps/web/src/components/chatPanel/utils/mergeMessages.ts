import type { ChatMessageView } from "../types";

export function mergeMessages(messages: ChatMessageView[], forumMessages: ChatMessageView[]) {
  const all = [...messages, ...forumMessages];
  const byId: Record<string, ChatMessageView> = {};
  all.forEach((m) => {
    byId[m.id] = m;
  });
  const arr = Object.values(byId);
  arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return arr;
}
