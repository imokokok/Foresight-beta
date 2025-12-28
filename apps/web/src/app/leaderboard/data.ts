import { buildDiceBearUrl } from "@/lib/dicebear";

// API 返回的排行榜用户类型
export type LeaderboardUser = {
  rank: number;
  wallet_address: string;
  username: string;
  avatar: string;
  trades_count: number;
  total_volume: number;
  profit: number;
  win_rate: number;
  trend: string;
  // 兼容旧字段
  name?: string;
  winRate?: string;
  trades?: number;
  tags?: string[];
  history?: number[];
  badge?: string;
  bestTrade?: string;
};

// 格式化数字显示
export function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return volume.toFixed(0);
}

// 格式化利润显示
export function formatProfit(profit: number): string {
  const prefix = profit >= 0 ? "+" : "";
  return `${prefix}${formatVolume(profit)}`;
}

// 获取徽章
export function getBadge(rank: number): string {
  switch (rank) {
    case 1:
      return "🏆 预言家";
    case 2:
      return "🥈 策略家";
    case 3:
      return "🥉 新星";
    default:
      return "";
  }
}

// 生成交易历史图表数据（模拟）
export function generateHistory(tradesCount: number): number[] {
  const points = 8;
  const history: number[] = [];
  let base = Math.random() * 50 + 20;
  for (let i = 0; i < points; i++) {
    base += (Math.random() - 0.4) * 15;
    base = Math.max(5, Math.min(100, base));
    history.push(Math.round(base));
  }
  return history;
}

// 生成标签
export function generateTags(tradesCount: number, winRate: number): string[] {
  const tags: string[] = [];
  if (tradesCount >= 50) tags.push("High Volume");
  if (winRate >= 70) tags.push("Sniper");
  if (winRate >= 60 && winRate < 70) tags.push("Consistent");
  if (tradesCount >= 100) tags.push("Active");
  if (tradesCount < 20) tags.push("Newbie");
  return tags.slice(0, 2);
}

// 转换 API 数据为完整的用户数据
export function transformLeaderboardData(data: LeaderboardUser[]): LeaderboardUser[] {
  return data.map((user, index) => ({
    ...user,
    rank: index + 1,
    name: user.username,
    winRate: `${user.win_rate}%`,
    trades: user.trades_count,
    badge: getBadge(index + 1),
    tags: generateTags(user.trades_count, user.win_rate),
    history: generateHistory(user.trades_count),
    bestTrade: `+${Math.round(user.total_volume * 0.1)}`,
    profit: formatProfit(user.profit),
  })) as unknown as LeaderboardUser[];
}

export function buildLeaderboardJsonLd(users: LeaderboardUser[] = []) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const items = users.slice(0, 50).map((user, index) => {
    const description = `交易量：${formatVolume(user.total_volume)}，胜率：${user.win_rate}%，交易次数：${user.trades_count}`;
    return {
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Person",
        name: user.username,
        description,
      },
    };
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: "Foresight 预测排行榜",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        url: baseUrl + "/leaderboard",
        itemListElement: items,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "首页",
            item: baseUrl + "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "预测排行榜",
            item: baseUrl + "/leaderboard",
          },
        ],
      },
    ],
  };
}
