import React from "react";
import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "card";
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const variantStyles = {
    text: "rounded-md h-4",
    circular: "rounded-full",
    rectangular: "rounded-xl",
    card: "rounded-2xl",
  };

  const Component = animate ? motion.div : "div";

  const animationProps = animate
    ? {
        animate: {
          opacity: [0.5, 0.8, 0.5],
        },
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }
    : {};

  return (
    <Component
      className={`bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 ${variantStyles[variant]} ${className}`}
      style={{
        width: width || "100%",
        height: height || (variant === "text" ? "1rem" : "100%"),
      }}
      {...animationProps}
    />
  );
}

/**
 * 预定义的骨架屏布局
 */

// 事件卡片骨架屏
export function EventCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden p-5 space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-3">
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width="90%" height={16} />
          <Skeleton variant="text" width="60%" height={16} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton variant="rectangular" width={80} height={32} />
        <Skeleton variant="rectangular" width={100} height={32} />
        <div className="flex-1" />
        <Skeleton variant="rectangular" width={60} height={32} />
      </div>
    </div>
  );
}

// Flag 卡片骨架屏
export function FlagCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={64} height={64} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="50%" height={24} />
          <Skeleton variant="text" width="70%" height={16} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Skeleton variant="rectangular" height={60} />
        <Skeleton variant="rectangular" height={60} />
        <Skeleton variant="rectangular" height={60} />
      </div>
      <Skeleton variant="rectangular" height={40} />
    </div>
  );
}

// 论坛话题骨架屏
export function ForumTopicSkeleton() {
  return (
    <div className="p-4 border-b border-gray-100 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="80%" height={18} />
          <Skeleton variant="text" width="60%" height={14} />
        </div>
      </div>
      <div className="flex items-center gap-4 ml-13">
        <Skeleton variant="text" width={60} height={12} />
        <Skeleton variant="text" width={80} height={12} />
      </div>
    </div>
  );
}

// 聊天消息骨架屏
export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 p-3">
      <Skeleton variant="circular" width={32} height={32} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="30%" height={14} />
        <Skeleton variant="rectangular" width="70%" height={60} className="rounded-2xl" />
      </div>
    </div>
  );
}

// 页面加载骨架屏（通用）
export function PageSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-4">
        <Skeleton variant="text" width="40%" height={32} />
        <Skeleton variant="text" width="60%" height={20} />
      </div>
      {children || (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        </>
      )}
    </div>
  );
}
