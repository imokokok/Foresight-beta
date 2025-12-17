/**
 * 懒加载组件包装器
 * 用于代码分割，减少初始 Bundle 大小
 */

import dynamic from "next/dynamic";
import { CardListSkeleton, ProfileSkeleton, TableSkeleton } from "./skeletons";

// 懒加载大型组件
export const KlineChart = dynamic(() => import("./KlineChart"), {
  loading: () => <div className="animate-pulse bg-gray-200 h-96 rounded-xl" />,
  ssr: false, // K线图不需要SSR
});

export const StickerGalleryModal = dynamic(() => import("./StickerGalleryModal"), {
  loading: () => <div className="animate-pulse bg-white h-64 rounded-xl" />,
  ssr: false,
});

export const StickerRevealModal = dynamic(() => import("./StickerRevealModal"), {
  loading: () => <div className="animate-pulse bg-white h-64 rounded-xl" />,
  ssr: false,
});

export const CreateFlagModal = dynamic(() => import("./CreateFlagModal"), {
  loading: () => <div className="animate-pulse bg-white h-96 rounded-xl" />,
  ssr: false,
});

export const ChatPanel = dynamic(() => import("./ChatPanel"), {
  loading: () => <div className="animate-pulse bg-white h-64 rounded-xl" />,
  ssr: false,
});

// 懒加载市场相关组件
export const MarketChart = dynamic(() => import("./market/MarketChart"), {
  loading: () => <div className="animate-pulse bg-gray-200 h-80 rounded-xl" />,
  ssr: false,
});

export const TradingPanel = dynamic(() => import("./market/TradingPanel"), {
  loading: () => <div className="animate-pulse bg-white h-96 rounded-xl" />,
  ssr: false,
});

// 懒加载排行榜
export const LeaderboardLazy = dynamic(() => import("./Leaderboard"), {
  loading: () => <TableSkeleton rows={10} columns={4} />,
});

// 懒加载论坛组件
export const ForumSection = dynamic(() => import("./ForumSection"), {
  loading: () => <CardListSkeleton count={3} />,
});
