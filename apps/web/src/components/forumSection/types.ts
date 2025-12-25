import type React from "react";

export interface ForumSectionProps {
  eventId: number;
  threadId?: number;
  hideCreate?: boolean;
}

export interface ThreadView {
  id: number;
  event_id: number;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  comments?: CommentView[];
}

export interface CommentView {
  id: number;
  thread_id: number;
  event_id: number;
  user_id: string;
  content: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  parent_id?: number | null;
}

export type ForumCategory =
  | "tech"
  | "entertainment"
  | "politics"
  | "weather"
  | "sports"
  | "business"
  | "crypto"
  | "more";

export type ActionVerb = "priceReach" | "willWin" | "willHappen";

export type ForumSectionViewProps = {
  hideCreate?: boolean;
  account: string | null | undefined;
  threads: ThreadView[];
  loading: boolean;
  error: string | null;
  subjectName: string;
  actionVerb: ActionVerb;
  targetValue: string;
  deadline: string;
  category: ForumCategory;
  titlePreview: string;
  criteriaPreview: string;
  formError: string;
  canSubmit: boolean;
  posting: boolean;
  userVotes: Set<string>;
  userVoteTypes: Record<string, "up" | "down">;
  displayName: (addr: string) => string;
  onConnectAndSign: () => Promise<void>;
  onSubjectNameChange: (value: string) => void;
  onActionVerbChange: (value: ActionVerb) => void;
  onTargetValueChange: (value: string) => void;
  onDeadlineChange: (value: string) => void;
  onCategoryChange: (value: ForumCategory) => void;
  onPostThread: () => Promise<void>;
  onVote: (type: "thread" | "comment", id: number, dir: "up" | "down") => Promise<void>;
  onPostComment: (threadId: number, text: string, parentId?: number | null) => Promise<void>;
};
