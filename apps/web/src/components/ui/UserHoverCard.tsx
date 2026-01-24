"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  TrendingUp,
  Zap,
  ExternalLink,
  Trophy,
  Medal,
  UserPlus,
  Star,
  UserMinus,
  Loader2,
  Users,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "@/lib/toast";
import { formatCompactNumber } from "@/lib/format";
import {
  fetcher,
  type UserFollowToggleResult,
  useUserFollowCounts,
  useUserFollowStatus,
} from "@/hooks/useQueries";
import { formatAddress, normalizeAddress } from "@/lib/address";

// 用户预览数据类型
export type UserPreviewData = {
  wallet_address: string;
  username?: string;
  name?: string;
  avatar?: string;
  rank?: number;
  total_volume?: number;
  trades_count?: number;
  win_rate?: number;
  trend?: string;
  tags?: string[];
  badge?: string;
};

type UserHoverCardProps = {
  user: UserPreviewData;
  children: React.ReactNode;
  delay?: number;
  position?: "top" | "bottom" | "left" | "right";
  disabled?: boolean;
};

// 获取排名徽章样式
function getRankBadge(rank: number | undefined) {
  if (!rank) return null;
  if (rank === 1) return { icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-100/80" };
  if (rank === 2) return { icon: Medal, color: "text-slate-400", bg: "bg-slate-100/80" };
  if (rank === 3) return { icon: Medal, color: "text-orange-400", bg: "bg-orange-100/80" };
  if (rank <= 10) return { icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-100/80" };
  return null;
}

const CARD_WIDTH = 320; // 稍微调宽
const CARD_HEIGHT = 380; // 估算高度
const OFFSET = 12; // 间距调大一点

export function UserHoverCard({
  user,
  children,
  delay = 300,
  position = "bottom",
  disabled = false,
}: UserHoverCardProps) {
  const t = useTranslations("userCard");
  const { address: myAccount } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = user.name || user.username || `User_${user.wallet_address?.slice(2, 8)}`;
  const avatar =
    user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.wallet_address}`;
  const profileUrl = `/profile/${user.wallet_address}`;
  const rankBadge = getRankBadge(user.rank);
  const myAccountNorm = myAccount ? normalizeAddress(myAccount) : null;
  const userAddressNorm = user.wallet_address ? normalizeAddress(user.wallet_address) : null;
  const isOwnProfile = myAccountNorm && userAddressNorm && myAccountNorm === userAddressNorm;

  const followCountsQuery = useUserFollowCounts(userAddressNorm);
  const followStatusQuery = useUserFollowStatus(userAddressNorm, myAccountNorm);

  useEffect(() => {
    if (followCountsQuery.data) {
      setFollowersCount(followCountsQuery.data.followersCount);
    }
  }, [followCountsQuery.data]);

  useEffect(() => {
    if (!isOwnProfile && typeof followStatusQuery.data === "boolean") {
      setIsFollowed(followStatusQuery.data);
    }
  }, [followStatusQuery.data, isOwnProfile]);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!myAccount) {
      toast.error(t("pleaseConnectWallet"));
      return;
    }

    setIsFollowLoading(true);
    try {
      const data = await fetcher<UserFollowToggleResult>("/api/user-follows/user", {
        method: "POST",
        body: JSON.stringify({ targetAddress: userAddressNorm || user.wallet_address }),
      });

      const followed = Boolean(data?.followed);
      setIsFollowed(followed);
      setFollowersCount((prev) => (followed ? prev + 1 : Math.max(0, prev - 1)));
      toast.success(followed ? t("followSuccess") : t("unfollowSuccess"));
    } catch {
      toast.error(t("followFailed"));
    } finally {
      setIsFollowLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = rect.top + scrollY - CARD_HEIGHT - OFFSET;
        left = rect.left + scrollX + rect.width / 2 - CARD_WIDTH / 2;
        break;
      case "bottom":
        top = rect.bottom + scrollY + OFFSET;
        left = rect.left + scrollX + rect.width / 2 - CARD_WIDTH / 2;
        break;
      case "left":
        top = rect.top + scrollY + rect.height / 2 - CARD_HEIGHT / 2;
        left = rect.left + scrollX - CARD_WIDTH - OFFSET;
        break;
      case "right":
        top = rect.top + scrollY + rect.height / 2 - CARD_HEIGHT / 2;
        left = rect.right + scrollX + OFFSET;
        break;
    }

    if (left < scrollX + 10) left = scrollX + 10;
    if (left + CARD_WIDTH > scrollX + viewportWidth - 10)
      left = scrollX + viewportWidth - CARD_WIDTH - 10;
    if (top < scrollY + 10) top = rect.bottom + scrollY + OFFSET;
    if (top + CARD_HEIGHT > scrollY + viewportHeight - 10)
      top = rect.top + scrollY - CARD_HEIGHT - OFFSET;

    setCardPosition({ top, left });
  }, [position]);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    calculatePosition();
    timeoutRef.current = setTimeout(() => {
      calculatePosition();
      setIsOpen(true);
    }, delay);
  }, [delay, disabled, calculatePosition]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const cardContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: position === "top" ? 20 : -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{
            position: "absolute",
            top: cardPosition.top,
            left: cardPosition.left,
            zIndex: 99999,
            pointerEvents: "auto",
          }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-[320px] bg-white/95 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] overflow-hidden ring-1 ring-black/5">
            {/* Cover Area with Animated Gradient */}
            <div className="h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/20 to-transparent" />

              {rankBadge && (
                <div
                  className={`absolute top-4 right-4 ${rankBadge.bg} backdrop-blur-md rounded-2xl px-3 py-1.5 flex items-center gap-2 border border-white/20 shadow-lg`}
                >
                  <rankBadge.icon className={`w-4 h-4 ${rankBadge.color} fill-current`} />
                  <span className={`text-xs font-black ${rankBadge.color} tracking-tighter`}>
                    RANK #{user.rank}
                  </span>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="px-6 pb-8 relative">
              {/* Avatar Overlap */}
              <div className="relative -mt-12 mb-4 flex justify-between items-end">
                <div className="p-1.5 rounded-[2rem] bg-white shadow-xl relative group">
                  <div className="w-24 h-24 rounded-[1.5rem] overflow-hidden bg-gray-50 border-2 border-gray-50">
                    <img
                      src={avatar}
                      alt={displayName}
                      className="w-full h-full object-cover transform transition-transform group-hover:scale-110 duration-500"
                    />
                  </div>
                  {user.rank && user.rank <= 3 && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                      <Star className="w-4 h-4 text-white fill-current" />
                    </div>
                  )}
                </div>

                {!isOwnProfile && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    className={`mb-1 px-5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-lg active:scale-95 flex items-center gap-2 group ${
                      isFollowed
                        ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
                        : "bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 hover:from-purple-400 hover:to-pink-400 hover:text-white"
                    }`}
                  >
                    {isFollowLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isFollowed ? (
                      <UserMinus className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                    )}
                    {isFollowLoading
                      ? t("loading") || "LOADING..."
                      : isFollowed
                        ? t("unfollow") || "UNFOLLOW"
                        : t("follow") || "FOLLOW"}
                  </button>
                )}
              </div>

              {/* Identity */}
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-gray-900 text-2xl tracking-tighter truncate leading-tight">
                    {displayName}
                  </h4>
                  {user.badge && (
                    <span className="text-xl filter drop-shadow-sm">
                      {user.badge.split(" ")[0]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 font-bold tracking-tight">
                  {formatAddress(user.wallet_address, 8, 6)}
                </p>
              </div>

              {/* Tags */}
              {user.tags && user.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {user.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-xl bg-purple-50 border border-purple-100/50 text-purple-600 text-[10px] font-black uppercase tracking-widest"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats Grid - Glassmorphism style */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100 text-center hover:bg-white hover:shadow-md transition-all">
                  <TrendingUp className="w-4 h-4 text-purple-500 mx-auto mb-1.5" />
                  <div className="text-sm font-black text-gray-900 leading-none mb-1">
                    {user.total_volume === undefined
                      ? "--"
                      : formatCompactNumber(user.total_volume)}
                  </div>
                  <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {t("volume")}
                  </div>
                </div>
                <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100 text-center hover:bg-white hover:shadow-md transition-all">
                  <Users className="w-4 h-4 text-emerald-500 mx-auto mb-1.5" />
                  <div className="text-sm font-black text-gray-900 leading-none mb-1">
                    {followersCount}
                  </div>
                  <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {t("followers") || "Followers"}
                  </div>
                </div>
                <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100 text-center hover:bg-white hover:shadow-md transition-all">
                  <Zap className="w-4 h-4 text-amber-500 mx-auto mb-1.5" />
                  <div className="text-sm font-black text-gray-900 leading-none mb-1">
                    {user.trades_count ?? "--"}
                  </div>
                  <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {t("trades")}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <Link href={profileUrl} className="block">
                <button className="w-full py-4 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white rounded-[1.25rem] text-sm font-black hover:shadow-xl hover:shadow-purple-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {t("viewProfile")}
                  <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link href={profileUrl} className="cursor-pointer">
        {children}
      </Link>
      {mounted && createPortal(cardContent, document.body)}
    </div>
  );
}

// 简化版：只包装头像
export function UserAvatar({
  user,
  size = "md",
  showHoverCard = true,
  className = "",
}: {
  user: UserPreviewData;
  size?: "sm" | "md" | "lg";
  showHoverCard?: boolean;
  className?: string;
}) {
  const sizeStyles = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const displayName = user.name || user.username || `User_${user.wallet_address?.slice(2, 8)}`;
  const avatar =
    user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.wallet_address}`;

  const avatarElement = (
    <img
      src={avatar}
      alt={displayName}
      className={`${sizeStyles[size]} rounded-full bg-gray-100 border-2 border-white shadow-sm object-cover hover:scale-110 transition-transform ${className}`}
    />
  );

  if (!showHoverCard) return avatarElement;

  return <UserHoverCard user={user}>{avatarElement}</UserHoverCard>;
}

// 简化版：只包装用户名
export function UserName({
  user,
  showHoverCard = true,
  className = "",
}: {
  user: UserPreviewData;
  showHoverCard?: boolean;
  className?: string;
}) {
  const displayName = user.name || user.username || `User_${user.wallet_address?.slice(2, 8)}`;

  const nameElement = (
    <span
      className={`font-bold hover:text-purple-600 transition-colors cursor-pointer ${className}`}
    >
      {displayName}
    </span>
  );

  if (!showHoverCard) return nameElement;

  return <UserHoverCard user={user}>{nameElement}</UserHoverCard>;
}
