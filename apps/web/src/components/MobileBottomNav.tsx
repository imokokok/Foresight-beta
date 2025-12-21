"use client";

import React from "react";
import { motion } from "framer-motion";
import { Home, TrendingUp, PlusCircle, MessageSquare, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useTranslations } from "@/lib/i18n";

/**
 * 移动端底部导航栏组件
 *
 * 特性：
 * - 固定在屏幕底部
 * - 5个主要导航项
 * - 当前页面高亮
 * - 平滑动画过渡
 * - 触摸友好（最小 44x44px）
 * - 仅在移动端显示
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const { account } = useWallet();

  const tNav = useTranslations("nav");
  const tPrediction = useTranslations("prediction");

  const navItems = [
    {
      icon: Home,
      label: tNav("home"),
      href: "/",
      color: "blue",
    },
    {
      icon: TrendingUp,
      label: tNav("trending"),
      href: "/trending",
      color: "purple",
    },
    {
      icon: PlusCircle,
      label: tPrediction("createPrediction"),
      href: "/prediction/new",
      color: "pink",
      special: true, // 特殊样式
    },
    {
      icon: MessageSquare,
      label: tNav("forum"),
      href: "/forum",
      color: "green",
    },
    {
      icon: User,
      label: tNav("profile"),
      href: account ? `/user/${account}` : "/login",
      color: "orange",
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          // 特殊样式（创建按钮）
          if (item.special) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center relative"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg -mt-6"
                >
                  <Icon className="w-7 h-7 text-white" />
                </motion.div>
                <span className="text-[10px] font-medium text-gray-600 mt-1">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center min-w-[60px] py-1 relative group"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-colors ${
                  isActive ? `bg-${item.color}-50` : "hover:bg-gray-50"
                }`}
              >
                <Icon
                  className={`w-6 h-6 transition-colors ${
                    isActive ? `text-${item.color}-600` : "text-gray-500 group-hover:text-gray-700"
                  }`}
                />
              </motion.div>

              {/* 活动指示器 */}
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className={`absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-${item.color}-600`}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}

              <span
                className={`text-[10px] font-medium mt-0.5 transition-colors ${
                  isActive ? `text-${item.color}-600` : "text-gray-500 group-hover:text-gray-700"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Safe area padding for iOS */}
      <div className="h-safe-area-inset-bottom bg-white" />
    </nav>
  );
}
