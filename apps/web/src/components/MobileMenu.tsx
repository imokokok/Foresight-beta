"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Menu, Home, Search, TrendingUp, MessageSquare, User, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatAddress } from "@/lib/address";

interface MobileMenuProps {
  className?: string;
}

/**
 * 移动端汉堡菜单组件
 *
 * 特性：
 * - 从左侧滑入的抽屉式菜单
 * - 响应式设计（仅在移动端显示）
 * - 平滑动画过渡
 * - 遮罩层点击关闭
 * - 菜单项高亮当前页面
 * - 支持登录/登出
 */
export default function MobileMenu({ className = "" }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { address, connect, disconnect } = useWallet();
  const tNav = useTranslations("nav");
  const tMobileNav = useTranslations("mobileNav");
  const firstItemRef = React.useRef<HTMLAnchorElement | null>(null);

  // 路由变化时自动关闭菜单
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // 禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && firstItemRef.current) {
      firstItemRef.current.focus();
    }
  }, [isOpen]);

  const menuItems = [
    { icon: Home, label: tNav("home"), href: "/trending" },
    { icon: TrendingUp, label: tNav("trending"), href: "/trending" },
    { icon: Search, label: tMobileNav("items.search"), href: "/search" },
    { icon: MessageSquare, label: tMobileNav("items.forum"), href: "/forum" },
    { icon: User, label: tMobileNav("items.me"), href: "/profile" },
  ];

  return (
    <>
      {/* 汉堡菜单按钮（仅在移动端显示） */}
      <button
        onClick={() => setIsOpen(true)}
        className={`lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors ${className}`}
        aria-label={tMobileNav("menuOpen")}
        aria-expanded={isOpen}
        aria-controls="mobile-menu-drawer"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* 菜单遮罩和内容 */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 遮罩层 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] lg:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* 菜单抽屉 */}
            <motion.div
              id="mobile-menu-drawer"
              role="dialog"
              aria-modal="true"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-white shadow-2xl z-[9999] lg:hidden overflow-y-auto"
            >
              {/* 菜单头部 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">F</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">Foresight</h2>
                    <p className="text-xs text-gray-500">{tMobileNav("marketSubtitle")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label={tMobileNav("menuClose")}
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* 用户信息（如果已登录） */}
              {address && (
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white shadow-sm overflow-hidden">
                      <img
                        src={`https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {formatAddress(address)}
                      </p>
                      <p className="text-xs text-gray-500">{tMobileNav("wallet.connected")}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 菜单项 */}
              <nav className="p-2">
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      ref={index === 0 ? firstItemRef : undefined}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive
                          ? "bg-purple-50 text-purple-600 font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${isActive ? "text-purple-600" : "text-gray-500"}`}
                      />
                      <span>{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-600"
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* 菜单底部 */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
                {address ? (
                  <button
                    onClick={() => {
                      disconnect();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>{tMobileNav("wallet.disconnect")}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await connect();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 shadow-md shadow-purple-200/50 hover:from-purple-400 hover:to-pink-400 hover:text-white transition-all font-medium"
                  >
                    <User className="w-5 h-5" />
                    <span>{tMobileNav("wallet.connect")}</span>
                  </button>
                )}
                <p className="text-xs text-gray-400 text-center mt-3">Version 1.0.0 Beta</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
