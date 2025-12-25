import { buildDiceBearUrl } from "@/lib/dicebear";

export type LeaderboardUser = {
  rank: number;
  name: string;
  profit: string;
  winRate: string;
  trades: number;
  avatar: string;
  trend: string;
  tags?: string[];
  history?: number[];
  badge?: string;
  bestTrade?: string;
};

export const leaderboardData: LeaderboardUser[] = [
  {
    rank: 1,
    name: "YangZ",
    profit: "+8,240",
    winRate: "82%",
    trades: 142,
    avatar: buildDiceBearUrl("YangZ", "&backgroundColor=FFD700&clothing=blazerAndShirt"),
    badge: "🏆 预言家",
    trend: "+12%",
    tags: ["High Volume", "Sniper"],
    history: [40, 55, 45, 60, 75, 65, 85, 90, 82],
    bestTrade: "BTC +400%",
  },
  {
    rank: 2,
    name: "lkbhua24",
    profit: "+5,120",
    winRate: "75%",
    trades: 98,
    avatar: buildDiceBearUrl("lkbhua24", "&backgroundColor=C0C0C0&clothing=hoodie"),
    badge: "🥈 策略家",
    trend: "+8%",
    tags: ["Consistent", "Macro"],
    history: [30, 35, 40, 38, 45, 50, 48, 55, 51],
    bestTrade: "ETH +250%",
  },
  {
    rank: 3,
    name: "Dave_DeFi",
    profit: "+3,450",
    winRate: "68%",
    trades: 112,
    avatar: buildDiceBearUrl("Dave_DeFi", "&backgroundColor=CD7F32&clothing=graphicShirt"),
    badge: "🥉 新星",
    trend: "+15%",
    tags: ["Aggressive"],
    history: [20, 40, 15, 50, 30, 60, 25, 45, 34],
    bestTrade: "SOL +180%",
  },
  {
    rank: 4,
    name: "Eve_NFT",
    profit: "+2,890",
    winRate: "65%",
    trades: 87,
    avatar: buildDiceBearUrl("Eve_NFT", "&backgroundColor=b6e3f4"),
    trend: "+5%",
    tags: ["NFT Degen"],
    history: [45, 42, 48, 40, 38, 42, 45, 28],
  },
  {
    rank: 5,
    name: "Frank_Whale",
    profit: "+1,920",
    winRate: "59%",
    trades: 65,
    avatar: buildDiceBearUrl("Frank_Whale", "&backgroundColor=c0aede"),
    trend: "-2%",
    tags: ["Whale"],
    history: [60, 58, 55, 52, 50, 48, 45, 19],
  },
  {
    rank: 6,
    name: "Grace_Yield",
    profit: "+1,240",
    winRate: "62%",
    trades: 45,
    avatar: buildDiceBearUrl("Grace_Yield", "&backgroundColor=ffdfbf"),
    trend: "+3%",
    tags: ["Yield Farmer"],
    history: [20, 22, 25, 24, 26, 28, 30, 12],
  },
  {
    rank: 7,
    name: "Helen_Stake",
    profit: "+980",
    winRate: "55%",
    trades: 32,
    avatar: buildDiceBearUrl("Helen_Stake", "&backgroundColor=d1d4f9"),
    trend: "+1%",
    tags: ["Staker"],
    history: [15, 16, 15, 17, 16, 18, 17, 9],
  },
  {
    rank: 8,
    name: "Ivan_Invest",
    profit: "+850",
    winRate: "51%",
    trades: 28,
    avatar: buildDiceBearUrl("Ivan_Invest", "&backgroundColor=ffd5dc"),
    trend: "+4%",
    tags: ["Investor"],
    history: [10, 12, 11, 13, 12, 14, 13, 8],
  },
  {
    rank: 9,
    name: "Jack_Trade",
    profit: "+720",
    winRate: "48%",
    trades: 22,
    avatar: buildDiceBearUrl("Jack_Trade", "&backgroundColor=c0aede"),
    trend: "0%",
    tags: ["Trader"],
    history: [8, 8, 8, 9, 8, 9, 8, 7],
  },
  {
    rank: 10,
    name: "Kate_Hold",
    profit: "+540",
    winRate: "45%",
    trades: 18,
    avatar: buildDiceBearUrl("Kate_Hold", "&backgroundColor=b6e3f4"),
    trend: "-1%",
    tags: ["Hodler"],
    history: [10, 9, 8, 7, 6, 5, 6, 5],
  },
];

export function buildLeaderboardJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const items = leaderboardData.slice(0, 50).map((user, index) => {
    const description = `预测收益：${user.profit}，胜率：${user.winRate}，交易次数：${user.trades}`;
    return {
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Person",
        name: user.name,
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
