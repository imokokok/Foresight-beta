import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { ApiResponses } from "@/lib/apiResponse";
import { isAdminSession } from "../admin/performance/_lib/auth";

export type LeaderboardEntry = {
  rank: number;
  wallet_address: string;
  username: string;
  avatar: string;
  trades_count: number;
  total_volume: number;
  profit: number;
  win_rate: number;
  trend: string;
  unique_markets?: number;
  first_trade_at?: string;
  last_trade_at?: string;
};

type TimeRange = "daily" | "weekly" | "monthly" | "all";
type Category = "profit" | "winrate" | "streak";

// 简单的内存缓存
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1分钟缓存

function getCacheKey(range: TimeRange, category: Category, limit: number): string {
  return `leaderboard:${range}:${category}:${limit}`;
}

function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "weekly") as TimeRange;
    const category = (searchParams.get("category") || "profit") as Category;
    const limitRaw = Number(searchParams.get("limit") || 50);
    const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 50));
    const noCache = searchParams.get("nocache") === "true";

    // 检查缓存
    const cacheKey = getCacheKey(range, category, limit);
    if (!noCache) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const client = getClient("leaderboard-api");
    if (!client) {
      return ApiResponses.internalError("Database not configured");
    }

    // 首先尝试从 user_trading_stats 表获取数据（已预计算）
    let leaderboard: LeaderboardEntry[] = [];

    const statsResult = await fetchFromStatsTable(client, range, limit);

    if (statsResult.success && statsResult.data.length > 0) {
      leaderboard = statsResult.data;
    } else {
      // 回退到直接从 trades 表聚合
      leaderboard = await fetchFromTradesTable(client, range, limit);
    }

    // 获取用户资料
    if (leaderboard.length > 0) {
      const addresses = leaderboard.map((u) => u.wallet_address);
      const { data: profiles } = await client
        .from("user_profiles")
        .select("wallet_address, username")
        .in("wallet_address", addresses);

      const profileRows = (profiles ?? []) as {
        wallet_address: string | null;
        username: string | null;
      }[];

      const profileMap: Record<string, string> = {};
      for (const p of profileRows) {
        if (p.wallet_address) {
          profileMap[p.wallet_address.toLowerCase()] = p.username || "";
        }
      }

      // 更新用户名和头像
      leaderboard = leaderboard.map((entry) => ({
        ...entry,
        username: profileMap[entry.wallet_address] || entry.username,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${entry.wallet_address}`,
      }));
    }

    // 根据分类重新排序
    leaderboard = sortByCategory(leaderboard, category);

    // 重新分配排名
    leaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    const response = {
      leaderboard,
      meta: {
        range,
        category,
        total_users: leaderboard.length,
        generated_at: new Date().toISOString(),
        cached: false,
      },
    };

    // 设置缓存
    setCache(cacheKey, { ...response, meta: { ...response.meta, cached: true } });

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Leaderboard API Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponses.internalError(
      "Failed to fetch leaderboard",
      process.env.NODE_ENV === "development" ? message : undefined
    );
  }
}

// 根据分类排序
function sortByCategory(data: LeaderboardEntry[], category: Category): LeaderboardEntry[] {
  return [...data].sort((a, b) => {
    switch (category) {
      case "profit":
        // 按交易量/利润排序（降序）
        return b.total_volume - a.total_volume;
      case "winrate":
        // 按胜率排序（降序），胜率相同时按交易量排序
        if (b.win_rate !== a.win_rate) {
          return b.win_rate - a.win_rate;
        }
        return b.total_volume - a.total_volume;
      case "streak":
        // 按交易次数排序（降序），作为"活跃度/连胜"的近似
        if (b.trades_count !== a.trades_count) {
          return b.trades_count - a.trades_count;
        }
        return b.win_rate - a.win_rate;
      default:
        return b.total_volume - a.total_volume;
    }
  });
}

// 从预计算的统计表获取数据
async function fetchFromStatsTable(
  client: any,
  range: TimeRange,
  limit: number
): Promise<{ success: boolean; data: LeaderboardEntry[] }> {
  try {
    // 根据时间范围选择排序字段
    let volumeField: string;
    let tradesField: string;

    switch (range) {
      case "daily":
        volumeField = "daily_volume";
        tradesField = "daily_trades";
        break;
      case "weekly":
        volumeField = "weekly_volume";
        tradesField = "weekly_trades";
        break;
      case "monthly":
        volumeField = "monthly_volume";
        tradesField = "monthly_trades";
        break;
      case "all":
      default:
        volumeField = "total_volume";
        tradesField = "trades_count";
    }

    const { data, error } = await client
      .from("user_trading_stats")
      .select("*")
      .gt(volumeField, 0)
      .order(volumeField, { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Stats table query failed:", error.message);
      return { success: false, data: [] };
    }

    if (!data || data.length === 0) {
      return { success: false, data: [] };
    }

    const leaderboard: LeaderboardEntry[] = data.map((row: any, index: number) => {
      const volume = parseFloat(row[volumeField] || 0);
      const trades = parseInt(row[tradesField] || 0);
      const buyVolume = parseFloat(row.buy_volume || 0);
      const totalVolume = parseFloat(row.total_volume || 0);

      // 计算胜率（基于买入比例作为近似）
      const winRate = totalVolume > 0 ? Math.round((buyVolume / totalVolume) * 100) : 50;

      // 计算趋势（基于最近交易活跃度）
      const weeklyVol = parseFloat(row.weekly_volume || 0);
      const monthlyVol = parseFloat(row.monthly_volume || 0);
      let trendValue = 0;
      if (monthlyVol > 0) {
        // 周交易量占月交易量的比例，乘以4是理想情况
        trendValue = Math.round(((weeklyVol / monthlyVol) * 4 - 1) * 100);
        trendValue = Math.max(-50, Math.min(50, trendValue)); // 限制范围
      }
      const trend = trendValue >= 0 ? `+${trendValue}%` : `${trendValue}%`;

      // 计算模拟利润
      const profit = Math.round(volume * 0.05 * (winRate / 50 - 0.5));

      return {
        rank: index + 1,
        wallet_address: row.wallet_address,
        username: `User_${row.wallet_address.slice(2, 8)}`,
        avatar: "",
        trades_count: trades,
        total_volume: Math.round(volume * 100) / 100,
        profit,
        win_rate: winRate,
        trend,
        unique_markets: row.unique_markets || 0,
        first_trade_at: row.first_trade_at,
        last_trade_at: row.last_trade_at,
      };
    });

    return { success: true, data: leaderboard };
  } catch (error) {
    console.warn("Stats table fetch error:", error);
    return { success: false, data: [] };
  }
}

// 从 trades 表直接聚合（回退方案）
async function fetchFromTradesTable(
  client: any,
  range: TimeRange,
  limit: number
): Promise<LeaderboardEntry[]> {
  // 获取时间过滤
  let timeFilter: string | null = null;
  const now = new Date();

  switch (range) {
    case "daily":
      now.setDate(now.getDate() - 1);
      timeFilter = now.toISOString();
      break;
    case "weekly":
      now.setDate(now.getDate() - 7);
      timeFilter = now.toISOString();
      break;
    case "monthly":
      now.setMonth(now.getMonth() - 1);
      timeFilter = now.toISOString();
      break;
    case "all":
    default:
      timeFilter = null;
  }

  let query = client.from("trades").select("taker_address, maker_address, amount, price, is_buy");

  if (timeFilter) {
    query = query.gte("block_timestamp", timeFilter);
  }

  const { data: trades, error } = await query;

  if (error || !trades) {
    console.error("Trades query error:", error);
    return [];
  }

  // 聚合用户交易数据
  const userStats: Record<
    string,
    {
      trades_count: number;
      total_volume: number;
      buy_volume: number;
      sell_volume: number;
    }
  > = {};

  for (const trade of trades) {
    const volume = (parseFloat(trade.amount || "0") * parseFloat(trade.price || "0")) / 1000000;

    // 统计 taker
    if (trade.taker_address) {
      const addr = trade.taker_address.toLowerCase();
      if (!userStats[addr]) {
        userStats[addr] = { trades_count: 0, total_volume: 0, buy_volume: 0, sell_volume: 0 };
      }
      userStats[addr].trades_count += 1;
      userStats[addr].total_volume += volume;
      if (trade.is_buy) {
        userStats[addr].buy_volume += volume;
      } else {
        userStats[addr].sell_volume += volume;
      }
    }

    // 统计 maker
    if (trade.maker_address) {
      const addr = trade.maker_address.toLowerCase();
      if (!userStats[addr]) {
        userStats[addr] = { trades_count: 0, total_volume: 0, buy_volume: 0, sell_volume: 0 };
      }
      userStats[addr].trades_count += 1;
      userStats[addr].total_volume += volume;
      if (!trade.is_buy) {
        userStats[addr].buy_volume += volume;
      } else {
        userStats[addr].sell_volume += volume;
      }
    }
  }

  // 按交易量排序
  const sortedUsers = Object.entries(userStats)
    .sort((a, b) => b[1].total_volume - a[1].total_volume)
    .slice(0, limit);

  return sortedUsers.map(([addr, stats], index) => {
    const winRate =
      stats.total_volume > 0 ? Math.round((stats.buy_volume / stats.total_volume) * 100) : 50;

    const trendValue = Math.round((Math.random() - 0.3) * 20);
    const trend = trendValue >= 0 ? `+${trendValue}%` : `${trendValue}%`;

    const profit = Math.round(stats.total_volume * 0.05 * (winRate / 50 - 0.5));

    return {
      rank: index + 1,
      wallet_address: addr,
      username: `User_${addr.slice(2, 8)}`,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${addr}`,
      trades_count: stats.trades_count,
      total_volume: Math.round(stats.total_volume * 100) / 100,
      profit,
      win_rate: winRate,
      trend,
    };
  });
}

// 手动刷新统计表的端点
export async function POST(req: NextRequest) {
  try {
    const client = getClient("leaderboard-refresh");
    if (!client) {
      return ApiResponses.internalError("Database not configured");
    }

    const admin = await isAdminSession(client as any, req);
    if (!admin.ok) {
      if (admin.reason === "unauthorized") return ApiResponses.unauthorized("未授权");
      return ApiResponses.forbidden("权限不足");
    }

    // 调用刷新函数
    const { error } = await client.rpc("refresh_user_trading_stats");

    if (error) {
      console.error("Failed to refresh stats:", error);
      return ApiResponses.databaseError("Failed to refresh stats", error.message);
    }

    // 清除缓存
    cache.clear();

    return NextResponse.json({
      success: true,
      message: "User trading stats refreshed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Refresh API Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponses.internalError(
      "Failed to refresh stats",
      process.env.NODE_ENV === "development" ? message : undefined
    );
  }
}
