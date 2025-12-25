export interface ChatPanelProps {
  eventId: number;
  roomTitle?: string;
  roomCategory?: string;
  isProposalRoom?: boolean;
  minHeightPx?: number;
  minHeightVh?: number;
  hideHeader?: boolean;
}

export interface ChatMessageView {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}
