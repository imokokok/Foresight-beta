"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Users,
  BarChart3,
  MessageSquare,
  Heart,
  Pin,
  Flag,
  Trophy,
  ShieldCheck,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import WalletModal from "./WalletModal";
import { useTranslations } from "@/lib/i18n";

type MenuItem = {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  requireWallet?: boolean;
  children?: MenuItem[];
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { account } = useWallet();
  const { user } = useAuth();
  const profileCtx = useUserProfileOptional();
  const isAdmin = !!profileCtx?.isAdmin;
  const t = useTranslations("nav");

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    markets: true,
    community: true,
    profile: true,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");

  const menu: MenuItem[] = useMemo(
    () => [
      {
        label: tCommon("menu"),
        children: [
          {
            label: t("trending"),
            href: "/trending",
            icon: <BarChart3 className="w-4 h-4" />,
          },
          {
            label: t("leaderboard"),
            href: "/leaderboard",
            icon: <Trophy className="w-4 h-4" />,
          },
          {
            label: t("forum"),
            href: "/forum",
            icon: <MessageSquare className="w-4 h-4" />,
          },
          {
            label: t("flags"),
            href: "/flags",
            icon: <Flag className="w-4 h-4" />,
          },
          {
            label: t("proposals"),
            href: "/proposals",
            icon: <Pin className="w-4 h-4" />,
          },
          {
            label: t("profile"),
            href: "/profile",
            icon: <Users className="w-4 h-4" />,
            requireWallet: true,
          },
          ...(isAdmin
            ? [
                {
                  label: t("admin"),
                  href: "/admin/predictions/new",
                  icon: <ShieldCheck className="w-4 h-4" />,
                  requireWallet: true,
                },
              ]
            : []),
        ],
      },
    ],
    [isAdmin, t, tCommon]
  );

  const isActive = (href?: string) => !!href && pathname === href;

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onItemClick = (item: MenuItem) => {
    if (item.requireWallet && !account) {
      setWalletModalOpen(true);
      return;
    }
    if (item.href) {
      router.push(item.href);
      setMobileOpen(false);
    }
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          className="px-3 py-2 rounded-xl bg-white/80 text-slate-700 border border-gray-200 shadow-sm"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={tCommon("menu")}
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar"
        >
          {tCommon("menu")}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        id="mobile-sidebar"
        role="navigation"
        aria-label={tCommon("mainNav")}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed lg:sticky top-0 lg:top-0 z-50 lg:z-30 h-screen lg:h-[calc(100vh)] w-[260px] flex-shrink-0 bg-white/40 backdrop-blur-2xl border-r border-white/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${
          mobileOpen ? "left-0" : "-left-[280px] lg:left-0"
        }`}
      >
        {/* Paper Texture Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] z-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />

        {/* Colorful Mesh Gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-purple-100/40 to-transparent pointer-events-none" />

        <div className="relative flex flex-col h-full p-4 z-10">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="relative w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center rotate-[-3deg] hover:rotate-0 transition-transform duration-300">
              <Image src="/images/logo.png" alt="Foresight" width={24} height={24} priority />
              <div className="absolute -top-1.5 -right-1.5 text-yellow-400 text-xs">✨</div>
            </div>
            <span className="font-black text-xl text-gray-800 tracking-tight">Foresight</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-6">
            {/* 导航分组 */}
            <div>
              <div className="px-2 mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="text-xs font-black text-gray-400 uppercase tracking-wider">
                  {tCommon("explore")}
                </span>
              </div>

              <div className="space-y-1">
                {menu[0].children!.map((it) => (
                  <button
                    key={it.label}
                    onClick={() => onItemClick(it)}
                    aria-label={it.label}
                    aria-current={isActive(it.href) ? "page" : undefined}
                    className={`group w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 relative overflow-hidden ${
                      isActive(it.href)
                        ? "bg-white text-slate-800 shadow-md shadow-purple-100/60 border border-purple-50"
                        : "hover:bg-white/60 text-gray-500 hover:text-slate-800"
                    }`}
                  >
                    {isActive(it.href) && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500 rounded-r-full" />
                    )}
                    <div
                      className={`transition-transform duration-300 ${isActive(it.href) ? "scale-110 text-purple-500" : "group-hover:scale-110"}`}
                      aria-hidden="true"
                    >
                      {it.icon}
                    </div>
                    <span className="text-sm font-bold">{it.label}</span>

                    {isActive(it.href) && (
                      <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-purple-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 用户区 */}
          <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
            {account || user ? (
              <div className="relative group cursor-pointer bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                {/* Tape */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-purple-100/80 rotate-2 z-10" />

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 p-0.5 border border-gray-100 overflow-hidden">
                    <Image
                      src={
                        account
                          ? `https://api.dicebear.com/7.x/identicon/svg?seed=${account}`
                          : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
                              user?.email || "guest"
                            )}&backgroundColor=e9d5ff`
                      }
                      alt="avatar"
                      width={40}
                      height={40}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black text-gray-800 truncate">
                      {account
                        ? `${String(account).slice(0, 6)}...${String(account).slice(-4)}`
                        : user?.email?.split("@")[0]}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                      {tCommon("userLevelDreamer").replace("{level}", "3")}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 font-bold border border-purple-200 shadow-md shadow-purple-200/80 hover:from-purple-400 hover:to-pink-400 hover:text-white hover:shadow-lg hover:shadow-purple-300/90 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group"
                onClick={() => setWalletModalOpen(true)}
                aria-label={tAuth("connectWallet")}
              >
                <span className="relative z-10">{tAuth("connectWallet")}</span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-purple-500/20 to-pink-500/20" />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </>
  );
}
