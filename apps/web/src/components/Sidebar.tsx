"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Search,
  Users,
  BarChart3,
  MessageSquare,
  Heart,
  Pin,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import WalletModal from "./WalletModal";

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
  const [isAdmin, setIsAdmin] = useState(false);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    markets: true,
    community: true,
    profile: true,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const menu: MenuItem[] = useMemo(
    () => [
      {
        label: "导航",
        children: [
          { label: "热门趋势", href: "/trending", icon: <BarChart3 className="w-4 h-4" /> },
          { label: "论坛", href: "/forum", icon: <MessageSquare className="w-4 h-4" /> },
          { label: "提案频道", href: "/proposals", icon: <Pin className="w-4 h-4" /> },
          { label: "我的关注", href: "/my-follows", icon: <Heart className="w-4 h-4" />, requireWallet: true },
          ...(isAdmin ? [{ label: "管理员中心", href: "/admin/predictions/new", icon: <Users className="w-4 h-4" />, requireWallet: true }] : []),
        ],
      },
    ],
    [isAdmin]
  );

  const isActive = (href?: string) => !!href && pathname === href;

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const submitSearch = () => {
    const q = searchText.trim();
    if (!q) return;
    router.push(`/trending?q=${encodeURIComponent(q)}`);
    setMobileOpen(false);
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

  useEffect(() => {
    const run = async () => {
      try {
        if (!account) { setIsAdmin(false); return }
        const res = await fetch(`/api/user-profiles?address=${String(account).toLowerCase()}`, { cache: 'no-store' })
        const j = await res.json().catch(() => ({}))
        setIsAdmin(!!j?.profile?.is_admin)
      } catch { setIsAdmin(false) }
    }
    run()
  }, [account])

  return (
    <>
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          className="px-3 py-2 rounded-xl bg-white/80 text-black border border-gray-200 shadow-sm"
          onClick={() => setMobileOpen((v) => !v)}
        >
          菜单
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
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed lg:sticky top-0 lg:top-0 z-50 lg:z-10 h-screen lg:h-[calc(100vh)] w-[240px] flex-shrink-0 bg-gradient-to-b from-purple-50 to-pink-50 border-r border-purple-200/40 backdrop-blur ${mobileOpen ? "left-0" : "-left-[260px] lg:left-0"}`}
      >
        <div className="flex flex-col h-full p-3">
          <div className="flex items-center gap-2 mb-3">
            <img src="/images/logo.png" alt="Foresight" className="w-8 h-8" />
            <span className="font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Foresight</span>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
              placeholder="搜索事件..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/80 border border-purple-200/60 text-black"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 -mr-1">
            <div className="space-y-2">
              {/* 导航分组 */}
              <div>
                <button
                  className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/70"
                  onClick={() => toggleGroup("markets")}
                >
                  <span className="text-sm font-semibold text-black">导航</span>
                  <ChevronDown className={`w-4 h-4 text-black transition-transform ${openGroups.markets ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {openGroups.markets && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-1"
                    >
                      <div className="flex flex-col gap-2">
                        {menu[0].children!.map((it) => (
                          <button
                            key={it.label}
                            onClick={() => onItemClick(it)}
                            className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-all ${isActive(it.href) ? "bg-purple-100 text-black" : "hover:bg-white/70 text-black"}`}
                          >
                            {it.icon}
                            <span className="text-sm">{it.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
              </AnimatePresence>
              </div>

              
            </div>
          </div>

          {/* 用户区 */}
          <div className="mt-2">
            {account || user ? (
              <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-white/80 border border-purple-200/60">
                <img
                  src={`https://api.dicebear.com/7.x/identicon/svg?seed=${account || user?.email || "guest"}`}
                  alt="avatar"
                  className="w-7 h-7 rounded-full"
                />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-black">{account ? `${String(account).slice(0,6)}…${String(account).slice(-4)}` : user?.email}</div>
                  <div className="text-[11px] text-gray-600">已登录</div>
                </div>
              </div>
            ) : (
              <button
                className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm"
                onClick={() => setWalletModalOpen(true)}
              >
                登录
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </>
  );
}
