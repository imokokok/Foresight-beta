"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import WalletModal from "@/components/WalletModal";
import { FlagCard, FlagItem } from "@/components/FlagCard";
import CreateFlagModal from "@/components/CreateFlagModal";
import StickerRevealModal, {
  OFFICIAL_STICKERS,
  StickerItem,
} from "@/components/StickerRevealModal";
import StickerGalleryModal from "@/components/StickerGalleryModal";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n";
import { useFlagsData } from "./useFlagsData";
import {
  Loader2,
  Plus,
  Sparkles,
  ArrowRight,
  Smile,
  Target,
  Clock,
  Zap,
  Users,
  X,
  Camera,
  Flag,
  Droplet,
  BookOpen,
  Brain,
  Moon,
  Sun,
  Home,
  Ban,
  Trophy,
  Flame,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
  LayoutGrid,
  List,
  MoreVertical,
  Calendar,
  Settings,
  Bell,
  CloudRain,
  Utensils,
  Footprints,
  Smartphone,
  Phone,
  Trash2,
  Coffee,
  PiggyBank,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FlagsPage() {
  const { account } = useWallet();
  const { user } = useAuth();
  const tFlags = useTranslations("flags");
  const [createOpen, setCreateOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Modal initial state
  const [initTitle, setInitTitle] = useState("");
  const [initDesc, setInitDesc] = useState("");

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinFlag, setCheckinFlag] = useState<FlagItem | null>(null);
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinImage, setCheckinImage] = useState("");
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFlag, setHistoryFlag] = useState<FlagItem | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<
    Array<{
      id: string;
      note: string;
      image_url?: string;
      created_at: string;
      review_status?: string;
      reviewer_id?: string;
      review_reason?: string;
    }>
  >([]);
  const [reviewSubmittingId, setReviewSubmittingId] = useState<string | null>(null);

  const [settlingId, setSettlingId] = useState<number | null>(null);

  const [stickerOpen, setStickerOpen] = useState(false);
  const [earnedSticker, setEarnedSticker] = useState<StickerItem | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Official challenges
  const [officialCreate, setOfficialCreate] = useState(false);
  const [officialListOpen, setOfficialListOpen] = useState(false);
  const [selectedTplId, setSelectedTplId] = useState("");
  const [tplConfig, setTplConfig] = useState<any>({});
  const {
    flags,
    loading,
    filterMine,
    setFilterMine,
    statusFilter,
    setStatusFilter,
    collectedStickers,
    dbStickers,
    inviteNotice,
    invitesCount,
    loadFlags,
    activeFlags,
    completedFlags,
    filteredFlags,
    viewerId,
    witnessFlags,
  } = useFlagsData(account, user?.id || null, tFlags);

  const officialTemplates = [
    {
      id: "early_bird",
      title: tFlags("official.templates.early_bird.title"),
      description: tFlags("official.templates.early_bird.description"),
      icon: Sun,
      color: "text-amber-500",
      gradient: "from-amber-100 to-orange-50",
      shadow: "shadow-amber-500/20",
    },
    {
      id: "reading_marathon",
      title: tFlags("official.templates.reading_marathon.title"),
      description: tFlags("official.templates.reading_marathon.description"),
      icon: BookOpen,
      color: "text-blue-500",
      gradient: "from-blue-100 to-cyan-50",
      shadow: "shadow-blue-500/20",
    },
    {
      id: "fitness_pro",
      title: tFlags("official.templates.fitness_pro.title"),
      description: tFlags("official.templates.fitness_pro.description"),
      icon: Zap,
      color: "text-emerald-500",
      gradient: "from-emerald-100 to-green-50",
      shadow: "shadow-emerald-500/20",
    },
    {
      id: "weather_prophet",
      title: tFlags("official.templates.weather_prophet.title"),
      description: tFlags("official.templates.weather_prophet.description"),
      icon: CloudRain,
      color: "text-sky-500",
      gradient: "from-sky-100 to-indigo-50",
      shadow: "shadow-sky-500/20",
    },
    {
      id: "no_takeout",
      title: tFlags("official.templates.no_takeout.title"),
      description: tFlags("official.templates.no_takeout.description"),
      icon: Utensils,
      color: "text-orange-500",
      gradient: "from-orange-100 to-amber-50",
      shadow: "shadow-orange-500/20",
    },
    {
      id: "sleep_early",
      title: tFlags("official.templates.sleep_early.title"),
      description: tFlags("official.templates.sleep_early.description"),
      icon: Moon,
      color: "text-indigo-500",
      gradient: "from-indigo-100 to-violet-50",
      shadow: "shadow-indigo-500/20",
    },
    {
      id: "walk_10k",
      title: tFlags("official.templates.walk_10k.title"),
      description: tFlags("official.templates.walk_10k.description"),
      icon: Footprints,
      color: "text-teal-500",
      gradient: "from-teal-100 to-emerald-50",
      shadow: "shadow-teal-500/20",
    },
    {
      id: "digital_detox",
      title: tFlags("official.templates.digital_detox.title"),
      description: tFlags("official.templates.digital_detox.description"),
      icon: Smartphone,
      color: "text-rose-500",
      gradient: "from-rose-100 to-pink-50",
      shadow: "shadow-rose-500/20",
    },
    {
      id: "declutter",
      title: tFlags("official.templates.declutter.title"),
      description: tFlags("official.templates.declutter.description"),
      icon: Trash2,
      color: "text-slate-500",
      gradient: "from-slate-100 to-gray-50",
      shadow: "shadow-slate-500/20",
    },
    {
      id: "call_parents",
      title: tFlags("official.templates.call_parents.title"),
      description: tFlags("official.templates.call_parents.description"),
      icon: Phone,
      color: "text-pink-500",
      gradient: "from-pink-100 to-rose-50",
      shadow: "shadow-pink-500/20",
    },
  ];

  const defaultConfigFor = (tplId: string) => {
    switch (tplId) {
      case "early_bird":
        return {
          days: 7,
          timesPerDay: 1,
          deposit: "10",
        };
      case "reading_marathon":
        return {
          days: 30,
          timesPerDay: 1,
          deposit: "50",
        };
      case "fitness_pro":
        return {
          days: 28,
          timesPerDay: 1,
          deposit: "100",
        };
      case "weather_prophet":
      case "no_takeout":
      case "sleep_early":
      case "walk_10k":
      case "digital_detox":
      case "declutter":
      case "call_parents":
        return {
          days: 1,
          timesPerDay: 1,
          deposit: "5",
        };
      case "no_sugar":
        return {
          days: 14,
          timesPerDay: 1,
          deposit: "20",
        };
      case "coding_streak":
        return {
          days: 30,
          timesPerDay: 1,
          deposit: "50",
        };
      default:
        return {};
    }
  };

  const handleCreateClick = () => {
    if (!account && !user) {
      setWalletModalOpen(true);
      return;
    }
    setInitTitle("");
    setInitDesc("");
    setOfficialCreate(false);
    setSelectedTplId("");
    setTplConfig({});
    setCreateOpen(true);
  };

  const openCheckin = (flag: FlagItem) => {
    const deadline = new Date(flag.deadline);
    const now = new Date();
    if (!Number.isNaN(deadline.getTime()) && now > deadline) {
      toast.info(tFlags("toast.checkinExpiredTitle"), tFlags("toast.checkinExpiredDesc"));
      return;
    }
    setCheckinFlag(flag);
    setCheckinNote("");
    setCheckinImage("");
    setCheckinOpen(true);
  };

  const submitCheckin = async () => {
    if (!checkinFlag) return;
    try {
      setCheckinSubmitting(true);
      const me = account || user?.id || "";
      const res = await fetch(`/api/flags/${checkinFlag.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: me,
          note: checkinNote,
          image_url: checkinImage,
        }),
      });
      if (!res.ok) throw new Error("Checkin failed");
      const ret = await res.json();

      // 1. 先关闭打卡框并刷新数据
      setCheckinOpen(false);
      loadFlags();

      // 2. 立即检查是否有表情包奖励
      if (ret.sticker_earned) {
        if (ret.sticker) {
          setEarnedSticker(ret.sticker);
          setTimeout(() => setStickerOpen(true), 100);
        } else if (ret.sticker_id) {
          // 从本地池中找到对应的表情包配置 (兼容旧逻辑)
          const s = OFFICIAL_STICKERS.find((x) => x.id === ret.sticker_id);
          if (s) {
            setEarnedSticker(s);
            // 延迟极短时间确保打卡框关闭动画不冲突，然后开启惊喜弹窗
            setTimeout(() => setStickerOpen(true), 100);
          }
        }
      }
    } catch (e) {
      toast.error(tFlags("toast.checkinFailedTitle"), tFlags("toast.checkinFailedDesc"));
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const openHistory = async (flag: FlagItem) => {
    setHistoryFlag(flag);
    setHistoryItems([]);
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const me = account || user?.id || "";
      const res = await fetch(
        `/api/flags/${flag.id}/checkins?limit=50&viewer_id=${encodeURIComponent(me)}`,
        {
          cache: "no-store",
        }
      );
      const data = await res.json().catch(() => ({}) as any);
      const items = Array.isArray(data?.items) ? data.items : [];
      setHistoryItems(items);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReview = async (checkinId: string, action: "approve" | "reject") => {
    try {
      setReviewSubmittingId(checkinId);
      const me = account || user?.id || "";
      const reasonKey =
        action === "reject" ? "history.reviewReason.rejected" : "history.reviewReason.approved";
      const reason = tFlags(reasonKey);
      const res = await fetch(`/api/checkins/${checkinId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer_id: me,
          action,
          reason,
        }),
      });
      if (!res.ok) throw new Error("Review failed");
      // refresh history
      if (historyFlag) openHistory(historyFlag);
    } catch (e) {
      toast.error(tFlags("toast.reviewFailedTitle"), tFlags("toast.reviewFailedDesc"));
    } finally {
      setReviewSubmittingId(null);
    }
  };

  const settleFlag = async (flag: FlagItem) => {
    if (!confirm(tFlags("toast.settleConfirmMessage"))) return;
    try {
      setSettlingId(flag.id);
      const me = account || user?.id || "";
      const res = await fetch(`/api/flags/${flag.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: me }),
      });
      if (!res.ok) throw new Error("Settle failed");
      const ret = await res.json();
      loadFlags();

      if (ret.sticker_earned) {
        if (ret.sticker) {
          setEarnedSticker(ret.sticker);
          setStickerOpen(true);
        } else {
          const s = OFFICIAL_STICKERS.find((x) => x.id === ret.sticker_id);
          if (s) {
            setEarnedSticker(s);
            setStickerOpen(true);
          }
        }
      } else {
        const statusText = String(ret?.status || "");
        const approvedDays = ret?.metrics?.approvedDays || 0;
        const totalDays = ret?.metrics?.totalDays || 0;
        const desc = `${tFlags("toast.statusLabel")}: ${statusText}，${tFlags(
          "toast.approvedDaysLabel"
        )} ${approvedDays}/${totalDays}`;
        toast.success(tFlags("toast.settleSuccessTitle"), desc);
      }
    } catch (e) {
      toast.error(
        tFlags("toast.settleFailedTitle"),
        String((e as any)?.message || tFlags("toast.retryLater"))
      );
    } finally {
      setSettlingId(null);
    }
  };

  const allStickers = dbStickers.length > 0 ? dbStickers : OFFICIAL_STICKERS;

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-[#FAFAFA] relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8 flex gap-6">
      {/* Organic Background Blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-200/40 rounded-full blur-[120px] mix-blend-multiply filter pointer-events-none animate-blob" />
      <div className="fixed top-[20%] right-[-10%] w-[600px] h-[600px] bg-pink-200/40 rounded-full blur-[120px] mix-blend-multiply filter pointer-events-none animate-blob animation-delay-2000" />
      <div className="fixed bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-orange-200/40 rounded-full blur-[120px] mix-blend-multiply filter pointer-events-none animate-blob animation-delay-4000" />

      {/* Grid Texture Overlay */}
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 pointer-events-none mix-blend-soft-light" />

      {/* LEFT SIDEBAR: Dashboard Control (Fixed Width) - REMOVED, merged into main view */}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 z-10 h-full max-w-[1600px] mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-6 px-8 pt-4">
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-gray-800 tracking-tight mb-2 relative inline-block">
              {tFlags("header.title")}
              <div className="absolute -top-6 -right-8 transform rotate-12">
                <div className="px-3 py-1 bg-yellow-300 text-yellow-800 text-xs font-black uppercase tracking-widest rounded-sm shadow-sm transform -rotate-3">
                  {tFlags("header.badge")}
                </div>
              </div>
            </h1>
            <div className="flex items-center gap-4 text-sm font-bold text-gray-500">
              <div className="flex items-center gap-1.5 bg-white/60 px-3 py-1.5 rounded-lg border border-white shadow-sm">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span>
                  {activeFlags.length} {tFlags("header.activeLabel")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/60 px-3 py-1.5 rounded-lg border border-white shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>
                  {completedFlags.length} {tFlags("header.achievedLabel")}
                </span>
              </div>
            </div>
            {invitesCount > 0 && (
              <div className="flex items-center gap-3 bg-white/80 px-4 py-2 rounded-2xl border border-amber-200 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 text-xs font-bold text-amber-800">
                  {tFlags("invites.textPrefix")}
                  {invitesCount}
                  {tFlags("invites.textSuffix")}
                  {inviteNotice?.title ? ` · ${inviteNotice.title}` : ""}
                </div>
                <button
                  onClick={() => {
                    if (!viewerId) return;
                    const pending = flags.filter(
                      (f) =>
                        f.status === "pending_review" &&
                        f.verification_type === "witness" &&
                        String(f.witness_id || "").toLowerCase() === viewerId
                    );
                    if (pending.length > 0) {
                      openHistory(pending[0]);
                    }
                  }}
                  className="text-[11px] font-black text-amber-700 bg-amber-100 px-3 py-1 rounded-xl hover:bg-amber-200 transition-colors"
                >
                  {tFlags("invites.button")}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* 重新设计的画廊入口 - 符合全站玻璃拟态风格 */}
            <button
              onClick={() => setGalleryOpen(true)}
              className="group flex items-center gap-3 px-6 py-2.5 bg-white/40 backdrop-blur-md border border-white/50 rounded-2xl shadow-soft hover:shadow-brand/20 hover:bg-white/60 transition-all duration-300 active:scale-95"
            >
              <div className="relative">
                <Smile className="w-5 h-5 text-brand group-hover:rotate-12 transition-transform duration-300" />
                <div className="absolute inset-0 bg-brand/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-sm font-black text-slate-800 tracking-tight">
                {tFlags("gallery.button")}
              </span>
              {collectedStickers.length > 0 && (
                <div className="flex items-center justify-center min-w-[20px] h-[20px] bg-brand/10 rounded-lg border border-brand/20">
                  <span className="text-[10px] font-black text-brand">
                    {collectedStickers.length}
                  </span>
                </div>
              )}
            </button>

            {/* Filter Tabs - Sticker Style */}
            <div className="flex items-center gap-2">
              <div className="flex bg-white/40 p-1 rounded-xl border border-white/50 backdrop-blur-sm">
                {[
                  { id: "all", label: tFlags("filters.all") },
                  { id: "active", label: tFlags("filters.active") },
                  { id: "success", label: tFlags("filters.success") },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                      statusFilter === tab.id
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {witnessFlags.length > 0 && (
                <button
                  onClick={() => {
                    if (witnessFlags.length > 0) {
                      openHistory(witnessFlags[0]);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-50 text-[11px] font-black text-purple-700 border border-purple-100 hover:bg-purple-100 transition-colors"
                >
                  {tFlags("filters.witnessRequests")} {witnessFlags.length}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Masonry Grid Container */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-8 pb-20">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <p className="text-sm font-bold text-gray-400">{tFlags("state.loading")}</p>
            </div>
          ) : (
            <div className="columns-1 md:columns-2 xl:columns-3 2xl:columns-4 gap-8 space-y-8 pb-20 mx-auto">
              {/* Create New Card - Always First */}
              <motion.div
                layout
                onClick={handleCreateClick}
                className="break-inside-avoid group cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative h-[300px] rounded-[2rem] border-[4px] border-dashed border-gray-300 bg-white/30 hover:bg-white/60 hover:border-purple-300 transition-all duration-300 flex flex-col items-center justify-center gap-4 text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:rotate-90 transition-all duration-500">
                    <Plus className="w-8 h-8 text-gray-400 group-hover:text-purple-500 transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-600 group-hover:text-purple-600 transition-colors">
                      {tFlags("createCard.title")}
                    </h3>
                    <p className="text-xs font-bold text-gray-400 mt-1">
                      {tFlags("createCard.subtitle")}
                    </p>
                  </div>
                  {/* Decorative Tape */}
                  <div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-gray-200/50 rotate-1 mask-tape"
                    style={{ clipPath: "polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)" }}
                  />
                </div>
              </motion.div>

              <AnimatePresence mode="popLayout">
                {filteredFlags.map((flag, index) => (
                  <motion.div
                    key={flag.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="break-inside-avoid"
                  >
                    <FlagCard
                      flag={flag}
                      isMine={
                        Boolean(account || user?.id) &&
                        String(flag.user_id || "").toLowerCase() ===
                          String(account || user?.id || "").toLowerCase()
                      }
                      onCheckin={() => openCheckin(flag)}
                      onViewHistory={() => openHistory(flag)}
                      onSettle={() => settleFlag(flag)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Inspiration & Extras */}
      <div className="hidden 2xl:flex flex-col w-72 shrink-0 gap-6 z-10 h-full overflow-y-auto scrollbar-hide pb-20">
        {/* Official Challenges Widget */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-5 border border-white/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-900">{tFlags("sidebar.trendingTitle")}</h3>
            <h3 className="text-sm font-black text-gray-900">{tFlags("sidebar.trendingTitle")}</h3>
            <button
              onClick={() => setOfficialListOpen(true)}
              className="text-[10px] font-bold text-purple-600 hover:underline"
            >
              {tFlags("sidebar.viewAll")}
            </button>
          </div>
          <div className="space-y-3">
            {officialTemplates.slice(0, 3).map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => {
                  setInitTitle(tpl.title);
                  setInitDesc(tpl.description);
                  setOfficialCreate(true);
                  setSelectedTplId(tpl.id);
                  setTplConfig(defaultConfigFor(tpl.id));
                  setCreateOpen(true);
                }}
                className="group p-3 rounded-2xl bg-white border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer flex gap-3 items-center"
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tpl.gradient} flex items-center justify-center text-white shadow-sm shrink-0`}
                >
                  <tpl.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-900 truncate group-hover:text-purple-700 transition-colors">
                    {tpl.title}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium truncate">
                    {tpl.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Quote / Motivation */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="relative z-10">
            <Sparkles className="w-5 h-5 text-yellow-300 mb-3" />
            <p className="text-sm font-bold leading-relaxed opacity-90 mb-4">
              {tFlags("sidebar.quote.text")}
            </p>
            <div className="flex items-center gap-2 text-[10px] font-medium opacity-60">
              <div className="w-1 h-1 rounded-full bg-white" />
              <span>{tFlags("sidebar.quote.label")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {officialListOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setOfficialListOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 sm:inset-10 z-50 bg-[#F0F2F5] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100 p-6 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900">
                      {tFlags("official.title")}
                    </h3>
                    <p className="text-sm font-bold text-gray-400">{tFlags("official.subtitle")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOfficialListOpen(false)}
                  className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                  {officialTemplates.map((tpl) => (
                    <motion.div
                      key={tpl.id}
                      whileHover={{ y: -8, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`group relative overflow-hidden rounded-[2rem] p-6 cursor-pointer transition-all duration-300 border border-white/40 shadow-lg hover:shadow-2xl bg-gradient-to-br ${tpl.gradient} ${tpl.shadow}`}
                      onClick={() => {
                        setOfficialListOpen(false);
                        setInitTitle(tpl.title);
                        setInitDesc(tpl.description);
                        setOfficialCreate(true);
                        setSelectedTplId(tpl.id);
                        setTplConfig(defaultConfigFor(tpl.id));
                        setCreateOpen(true);
                      }}
                    >
                      {/* Decorative Elements */}
                      <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                      <div className="absolute top-0 left-0 w-full h-full bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />

                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-6">
                          <div
                            className={`w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ${tpl.color}`}
                          >
                            <tpl.icon className="w-7 h-7" />
                          </div>
                          <div className="px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-md border border-white/40 flex items-center gap-1.5 shadow-sm">
                            <ShieldCheck className={`w-3.5 h-3.5 ${tpl.color}`} />
                            <span className={`text-[10px] font-extrabold ${tpl.color}`}>
                              OFFICIAL
                            </span>
                          </div>
                        </div>

                        <h3 className="text-xl font-black text-gray-900 mb-2 tracking-tight group-hover:translate-x-1 transition-transform duration-300">
                          {tpl.title}
                        </h3>
                        <p className="text-sm font-bold text-gray-700/90 leading-relaxed line-clamp-2 mb-6 h-10">
                          {tpl.description}
                        </p>

                        <div
                          className={`flex items-center gap-2 text-xs font-black ${tpl.color} bg-white/80 w-fit px-4 py-2 rounded-xl backdrop-blur-sm shadow-sm group-hover:bg-white group-hover:scale-105 transition-all duration-300`}
                        >
                          <span className="tracking-wide">{tFlags("official.cta")}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CreateFlagModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          loadFlags();
        }}
        defaultTemplateId={selectedTplId}
        defaultConfig={tplConfig}
        defaultTitle={initTitle}
        defaultDesc={initDesc}
        isOfficial={officialCreate}
      />

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />

      <StickerRevealModal
        isOpen={stickerOpen}
        onClose={() => setStickerOpen(false)}
        sticker={earnedSticker || undefined}
      />

      <StickerGalleryModal
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        collectedIds={collectedStickers}
        stickers={allStickers}
      />

      {/* Checkin Modal */}
      <AnimatePresence>
        {checkinOpen && checkinFlag && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setCheckinOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-purple-500/10 z-50 p-8 overflow-hidden border border-white/50"
            >
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-50/60 to-transparent pointer-events-none" />
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-200/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900">{tFlags("checkin.title")}</h3>
                    <p className="text-sm text-gray-500 font-medium">
                      {tFlags("checkin.subtitle")}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">
                      {tFlags("checkin.noteLabel")}
                    </label>
                    <textarea
                      value={checkinNote}
                      onChange={(e) => setCheckinNote(e.target.value)}
                      placeholder={tFlags("checkin.notePlaceholder")}
                      rows={4}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50/80 border border-transparent focus:bg-white focus:border-emerald-500 outline-none transition-all text-gray-900 resize-none font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">
                      {tFlags("checkin.imageLabel")}
                    </label>
                    <input
                      value={checkinImage}
                      onChange={(e) => setCheckinImage(e.target.value)}
                      placeholder={tFlags("checkin.imagePlaceholder")}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50/80 border border-transparent focus:bg-white focus:border-emerald-500 outline-none transition-all text-gray-900 font-medium"
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setCheckinOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                  >
                    {tFlags("checkin.cancel")}
                  </button>
                  <button
                    onClick={submitCheckin}
                    disabled={checkinSubmitting}
                    className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:translate-y-0"
                  >
                    {checkinSubmitting ? tFlags("checkin.submitLoading") : tFlags("checkin.submit")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {historyOpen && historyFlag && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setHistoryOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-xl shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">{tFlags("history.title")}</h3>
                  {historyFlag.verification_type === "witness" && historyFlag.witness_id && (
                    <div className="mt-1 text-xs font-bold text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{tFlags("history.witnessLabel")}</span>
                      <span className="text-gray-700">
                        {historyFlag.witness_id.length > 12
                          ? `${historyFlag.witness_id.slice(0, 6)}...${historyFlag.witness_id.slice(-4)}`
                          : historyFlag.witness_id}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {historyLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  </div>
                ) : historyItems.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 font-medium">
                    {tFlags("history.empty")}
                  </div>
                ) : (
                  <div className="relative border-l-2 border-gray-100 ml-4 space-y-8">
                    {historyItems.map((item, idx) => (
                      <div key={item.id} className="relative pl-8">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-purple-500" />
                        <div className="text-xs font-bold text-gray-400 mb-1">
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                          <p className="text-gray-900 font-medium mb-2">{item.note}</p>
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt="Proof"
                              className="w-full rounded-lg mb-2 object-cover max-h-48"
                            />
                          )}

                          {item.review_status === "pending" &&
                            historyFlag.verification_type === "witness" && (
                              <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                                {String(historyFlag.witness_id || "").toLowerCase() === viewerId ? (
                                  <>
                                    <button
                                      disabled={!!reviewSubmittingId}
                                      onClick={() => handleReview(item.id, "approve")}
                                      className="flex-1 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-200"
                                    >
                                      {reviewSubmittingId === item.id
                                        ? "..."
                                        : tFlags("history.actions.approve")}
                                    </button>
                                    <button
                                      disabled={!!reviewSubmittingId}
                                      onClick={() => handleReview(item.id, "reject")}
                                      className="flex-1 py-1.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-200"
                                    >
                                      {reviewSubmittingId === item.id
                                        ? "..."
                                        : tFlags("history.actions.reject")}
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />{" "}
                                    {tFlags("history.status.waitingReview")}
                                  </span>
                                )}
                              </div>
                            )}
                          {item.review_status === "approved" && (
                            <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />{" "}
                              {tFlags("history.status.approved")}
                            </div>
                          )}
                          {item.review_status === "rejected" && (
                            <div className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
                              <X className="w-3 h-3" /> {tFlags("history.status.rejected")}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
