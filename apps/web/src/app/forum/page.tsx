"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { MessageCircle, Search, Activity, Users, Plus, Flame, Clock, Trophy } from "lucide-react";
import GradientPage from "@/components/ui/GradientPage";
import { useForumList } from "./useForumList";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/lib/i18n";

export default function ForumPage() {
  const router = useRouter();
  const { account } = useWallet();
  const { user } = useAuth();
  const tForum = useTranslations("forum");

  const {
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    filtered,
    loading,
    loadingMore,
    hasNextPage,
    loadMore,
    total,
    predictions,
  } = useForumList();

  const [viewFilter, setViewFilter] = React.useState<"hot" | "new" | "top">("hot");

  const { ref: loadMoreRef, inView } = useInView({
    rootMargin: "200px",
  });

  React.useEffect(() => {
    if (inView && hasNextPage && !loadingMore && loadMore) {
      loadMore();
    }
  }, [inView, hasNextPage, loadingMore, loadMore]);

  const displayName = (account || user?.email || tForum("guestFallback")).slice(0, 12);
  const loadedTopicsCount = filtered.length;
  const totalTopicsCount =
    typeof total === "number" && total > 0 ? total : loadedTopicsCount || predictions.length;

  const sortedTopics = React.useMemo(() => {
    const items = [...filtered];

    const getTime = (value?: string) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    if (viewFilter === "new") {
      items.sort((a, b) => getTime(b.created_at) - getTime(a.created_at));
    } else if (viewFilter === "hot") {
      items.sort((a, b) => {
        const fa = a.followers_count ?? 0;
        const fb = b.followers_count ?? 0;
        return fb - fa;
      });
    } else {
      items.sort((a, b) => {
        const fa = a.followers_count ?? 0;
        const fb = b.followers_count ?? 0;
        if (fb !== fa) return fb - fa;
        return getTime(b.created_at) - getTime(a.created_at);
      });
    }

    return items;
  }, [filtered, viewFilter]);

  return (
    <GradientPage className="min-h-[calc(100vh-64px)] w-full relative overflow-x-hidden font-sans p-4 sm:p-6 lg:p-8 flex gap-6 text-[var(--foreground)]">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
      </div>

      <div className="hidden lg:flex flex-col w-64 shrink-0 gap-6 z-10 pb-20">
        <div className="bg-white border border-gray-200 rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col gap-4 relative">
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-purple-100/80 backdrop-blur-sm rotate-[-2deg] shadow-sm mask-tape"
            style={{ clipPath: "polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)" }}
          />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden p-0.5">
              <img
                src={
                  account
                    ? `https://api.dicebear.com/7.x/identicon/svg?seed=${account}`
                    : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
                        user?.email || tForum("guestFallback")
                      )}&backgroundColor=e9d5ff`
                }
                alt="Avatar"
                loading="lazy"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                {tForum("sidebarSubtitle")}
              </div>
              <div className="text-sm font-black text-gray-800 truncate">{displayName}</div>
            </div>
          </div>

          <div className="h-px bg-dashed-line my-1" />

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl p-2">
              <div className="text-lg font-black text-gray-800">{loadedTopicsCount}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">
                {tForum("sidebar.loadedTopics")}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-2">
              <div className="text-lg font-black text-gray-800">{totalTopicsCount}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">
                {tForum("sidebar.totalTopics")}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/trending")}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 text-xs font-bold border border-purple-200 shadow-md shadow-purple-200/80 hover:from-purple-400 hover:to-pink-400 hover:text-white hover:shadow-lg hover:shadow-purple-300/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            {tForum("sidebar.gotoMarketCta")}
          </button>
        </div>

        <div className="px-2 text-[11px] text-slate-600 leading-relaxed">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="font-semibold text-slate-800">{tForum("sidebar.summaryTitle")}</span>
          </div>
          <p className="mb-1">{tForum("sidebar.summaryBody")}</p>
          <p className="text-[10px] text-slate-500">
            {tForum("sidebar.helperPrefix")}{" "}
            <Link
              href="/trending"
              className="text-purple-600 hover:text-purple-700 hover:underline"
            >
              {tForum("sidebar.helperTrending")}
            </Link>{" "}
            {tForum("sidebar.helperMiddle")}{" "}
            <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
              {tForum("sidebar.helperForum")}
            </Link>{" "}
            {tForum("sidebar.helperSuffix")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="px-3 py-1 text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            {tForum("sidebar.views")}
          </div>
          {[
            { id: "hot", label: tForum("sidebar.viewHot"), icon: Flame },
            { id: "new", label: tForum("sidebar.viewNew"), icon: Clock },
            { id: "top", label: tForum("sidebar.viewTop"), icon: Trophy },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setViewFilter(item.id as "hot" | "new" | "top")}
              aria-pressed={viewFilter === item.id}
              className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all relative overflow-hidden ${
                viewFilter === item.id
                  ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                  : "text-gray-500 hover:bg-white/60 hover:text-gray-900"
              }`}
            >
              {viewFilter === item.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-500 rounded-r-full" />
              )}
              <item.icon
                className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                  viewFilter === item.id
                    ? "text-purple-500"
                    : "text-gray-400 group-hover:text-purple-500"
                }`}
              />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 z-10">
        <div className="flex flex-col h-full">
          <div className="lg:hidden flex items-center justify-between mb-4 px-2 pt-3">
            <h1 className="text-2xl font-black text-purple-700">{tForum("sidebarTitle")}</h1>
            <button
              type="button"
              onClick={() => router.push("/trending")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 shadow-sm shadow-purple-200/70 hover:from-purple-400 hover:to-pink-400 hover:text-white hover:shadow-md hover:shadow-purple-300/80 active:scale-[0.97] transition-all"
            >
              <Flame className="w-3.5 h-3.5" />
              {tForum("sidebar.gotoMarketCta")}
            </button>
          </div>

          <div className="flex flex-col flex-1 px-2 pb-4">
            <div className="flex-none mb-4 sticky top-0 z-20 backdrop-blur-sm py-2 -mx-2 px-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={tForum("searchPlaceholder")}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white/80 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-400/80"
                    />
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <Activity className="w-3 h-3" />
                    <span>{filtered.length}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      aria-pressed={activeCategory === cat.id}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                        activeCategory === cat.id
                          ? "bg-gradient-to-r from-purple-300 to-pink-300 text-purple-800 shadow-md shadow-purple-200/50 border border-purple-200 scale-105"
                          : "bg-transparent text-slate-500 border border-slate-300/60 hover:border-purple-200 hover:bg-purple-50/80"
                      }`}
                    >
                      <cat.icon
                        className={`w-3.5 h-3.5 ${
                          activeCategory === cat.id ? "text-purple-700" : "text-slate-400"
                        }`}
                      />
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                  <div className="w-8 h-8 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-bold text-slate-400">{tForum("list.loading")}</p>
                </div>
              ) : sortedTopics.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200">
                    <MessageCircle className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-black text-purple-700 mb-2">
                    {tForum("emptyTopics")}
                  </h3>
                </div>
              ) : (
                <div className="flex flex-col gap-4 pb-20">
                  <AnimatePresence mode="popLayout">
                    {sortedTopics.map((topic) => (
                      <motion.div
                        key={topic.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      >
                        <Link
                          href={`/forum/${topic.id}`}
                          className="block w-full text-left bg-white/80 border border-purple-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-purple-200 transition-all"
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100">
                                {topic.category || tForum("categoryFallback")}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {topic.created_at
                                  ? new Date(topic.created_at).toLocaleDateString()
                                  : ""}
                              </span>
                            </div>
                            <div className="text-sm sm:text-base font-bold text-slate-800 line-clamp-2">
                              {topic.title}
                            </div>
                            {topic.description && (
                              <div className="text-xs text-slate-500 line-clamp-2">
                                {topic.description}
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {topic.followers_count ?? 0}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                    {loadingMore && (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <div className="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                        <span>{tForum("list.loading")}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </GradientPage>
  );
}
