export interface ChatPanelProps {
  eventId: number;
  roomTitle?: string;
  roomCategory?: string;
  hideHeader?: boolean;
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
}
