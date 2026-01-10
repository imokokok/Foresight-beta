export interface ChatPanelProps {
  eventId: number;
  roomTitle?: string;
  roomCategory?: string;
  hideHeader?: boolean;
  className?: string;
}

export interface ChatMessageView {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  topic?: string;
  reply_to_id?: string;
  reply_to_content?: string;
  reply_to_user?: string;
  image_url?: string;
  debate_stance?: "pro" | "con" | "uncertain";
  debate_kind?: "claim" | "evidence" | "rebuttal" | "question" | "summary";
}
