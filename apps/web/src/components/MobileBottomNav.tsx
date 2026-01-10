"use client";

import { motion } from "framer-motion";
import { Home, TrendingUp, PlusCircle, MessageSquare, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
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
  const { account, connectWallet } = useWallet();
  const profileCtx = useUserProfileOptional();
  const isAdmin = !!profileCtx?.isAdmin;

  const tNav = useTranslations("nav");
  const tPrediction = useTranslations("prediction");

  const colorClasses = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", indicator: "bg-blue-600" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", indicator: "bg-purple-600" },
    pink: { bg: "bg-pink-50", text: "text-pink-600", indicator: "bg-pink-600" },
    green: { bg: "bg-green-50", text: "text-green-600", indicator: "bg-green-600" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", indicator: "bg-orange-600" },
  } as const;

  const createHref = isAdmin ? "/admin/predictions/new" : "/proposals";

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
      href: createHref,
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
      href: "/profile",
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
          const color = colorClasses[item.color as keyof typeof colorClasses];

          // 特殊样式（创建按钮）
          if (item.special) {
            return (
              <div key={item.href} className="flex flex-col items-center justify-center relative">
                {account || !isAdmin ? (
                  <Link href={item.href} className="flex flex-col items-center justify-center">
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg -mt-6"
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </motion.div>
                    <span className="text-[10px] font-medium text-gray-600 mt-1">{item.label}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await connectWallet();
                    }}
                    className="flex flex-col items-center justify-center"
                  >
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg -mt-6"
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </motion.div>
                    <span className="text-[10px] font-medium text-gray-600 mt-1">{item.label}</span>
                  </button>
                )}
              </div>
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
                className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-colors ${isActive ? color.bg : "hover:bg-gray-50"}`}
              >
                <Icon
                  className={`w-6 h-6 transition-colors ${isActive ? color.text : "text-gray-500 group-hover:text-gray-700"}`}
                />
              </motion.div>

              {/* 活动指示器 */}
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className={`absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full ${color.indicator}`}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}

              <span
                className={`text-[10px] font-medium mt-0.5 transition-colors ${isActive ? color.text : "text-gray-500 group-hover:text-gray-700"}`}
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
