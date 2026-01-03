import { formatRelativeTime } from "@/lib/format";

export function getTimeAgo(timestamp: string): string {
  if (!timestamp) return "";
  return formatRelativeTime(timestamp);
}

export function getTimeRemaining(deadline: string): string {
  const now = new Date();
  const end = new Date(deadline);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return "已截止";

  const diffDays = Math.floor(diffMs / 86400000);
  const diffHours = Math.floor((diffMs % 86400000) / 3600000);

  if (diffDays > 0) return `${diffDays}天${diffHours}小时后截止`;
  if (diffHours > 0) return `${diffHours}小时后截止`;
  return "即将截止";
}
