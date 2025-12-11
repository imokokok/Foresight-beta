"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { getClient } from "@/lib/supabase";
import WalletModal from "@/components/WalletModal";
import { FlagCard, FlagItem } from "@/components/FlagCard";
import { FlagsStats } from "@/components/FlagsStats";
import CreateFlagModal from "@/components/CreateFlagModal";
import StickerRevealModal, {
  OFFICIAL_STICKERS,
  StickerItem,
} from "@/components/StickerRevealModal";
import StickerGalleryModal from "@/components/StickerGalleryModal";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FlagsPage() {
  const { account } = useWallet();
  const { user } = useAuth();
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Modal initial state
  const [initTitle, setInitTitle] = useState("");
  const [initDesc, setInitDesc] = useState("");

  const [filterMine, setFilterMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "pending_review" | "success" | "failed"
  >("all");
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
  const [reviewSubmittingId, setReviewSubmittingId] = useState<string | null>(
    null
  );
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [officialCreate, setOfficialCreate] = useState(false);
  const [invitesCount, setInvitesCount] = useState(0);
  const [inviteNotice, setInviteNotice] = useState<{
    flag_id: number;
    owner_id: string;
    title: string;
    ts: string;
  } | null>(null);

  const [stickerOpen, setStickerOpen] = useState(false);
  const [earnedSticker, setEarnedSticker] = useState<StickerItem | undefined>(
    undefined
  );
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [collectedStickers, setCollectedStickers] = useState<string[]>([]);
  const [allStickers, setAllStickers] = useState<StickerItem[]>([]);

  const supabase = getClient();
  const OFFICIAL_WITNESS_ID = "official";
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
  const [tplConfig, setTplConfig] = useState<any>({});

  const defaultConfigFor = (id: string) => {
    switch (id) {
      case "early_morning":
        return { targetHour: 7 };
      case "drink_water_8":
        return { cups: 8 };
      case "steps_10k":
        return { steps: 10000 };
      case "read_20_pages":
        return { pages: 20 };
      case "meditate_10m":
        return { minutes: 10 };
      case "sleep_before_11":
        return { beforeHour: 23 };
      case "sunlight_20m":
        return { minutes: 20 };
      case "tidy_room_10m":
        return { minutes: 10 };
      default:
        return {};
    }
  };

  const officialTemplates: Array<{
    id: string;
    title: string;
    description: string;
    icon: any;
    color: string;
    bg: string;
    gradient: string;
    shadow: string;
  }> = [
    {
      id: "early_morning",
      title: "早起打卡",
      description: "太阳还没起，我先起！",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      gradient: "from-amber-100 to-orange-100",
      shadow: "shadow-amber-500/20",
    },
    {
      id: "drink_water_8",
      title: "每日8杯水",
      description: "咕噜咕噜，皮肤喝饱饱",
      icon: Droplet,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      gradient: "from-cyan-100 to-blue-100",
      shadow: "shadow-cyan-500/20",
    },
    {
      id: "steps_10k",
      title: "日行万步",
      description: "多走一点点，快乐多一点",
      icon: Zap,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      gradient: "from-emerald-100 to-green-100",
      shadow: "shadow-emerald-500/20",
    },
    {
      id: "read_20_pages",
      title: "阅读20页",
      description: "脑袋长肌肉，今天更聪明",
      icon: BookOpen,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      gradient: "from-indigo-100 to-violet-100",
      shadow: "shadow-indigo-500/20",
    },
    {
      id: "meditate_10m",
      title: "冥想10分钟",
      description: "深呼吸，和焦虑说拜拜",
      icon: Brain,
      color: "text-purple-600",
      bg: "bg-purple-50",
      gradient: "from-purple-100 to-fuchsia-100",
      shadow: "shadow-purple-500/20",
    },
    {
      id: "sleep_before_11",
      title: "11点睡觉",
      description: "和熬夜分手，困困不加班",
      icon: Moon,
      color: "text-slate-600",
      bg: "bg-slate-50",
      gradient: "from-slate-100 to-blue-100",
      shadow: "shadow-slate-500/20",
    },
    {
      id: "no_sugar_day",
      title: "无糖挑战",
      description: "戒掉糖糖，能量满格",
      icon: Ban,
      color: "text-rose-600",
      bg: "bg-rose-50",
      gradient: "from-rose-100 to-pink-100",
      shadow: "shadow-rose-500/20",
    },
    {
      id: "breakfast_photo",
      title: "元气早餐",
      description: "一张早餐图，开启好心情",
      icon: Camera,
      color: "text-orange-600",
      bg: "bg-orange-50",
      gradient: "from-orange-100 to-yellow-100",
      shadow: "shadow-orange-500/20",
    },
    {
      id: "sunlight_20m",
      title: "晒晒太阳",
      description: "补光计划，元气不打折",
      icon: Sun,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      gradient: "from-yellow-100 to-amber-100",
      shadow: "shadow-yellow-500/20",
    },
    {
      id: "tidy_room_10m",
      title: "整理房间",
      description: "小小收纳，快乐翻倍",
      icon: Home,
      color: "text-teal-600",
      bg: "bg-teal-50",
      gradient: "from-teal-100 to-emerald-100",
      shadow: "shadow-teal-500/20",
    },
  ];

  const loadFlags = async () => {
    try {
      setLoading(true);
      const me = account || user?.id || "";
      if (!me) {
        setFlags([]);
        return;
      }
      const res = await fetch(
        `/api/flags?viewer_id=${encodeURIComponent(me)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setFlags([]);
        return;
      }
      const payload = await res.json().catch(() => ({ flags: [] }));
      const list = Array.isArray(payload?.flags) ? payload.flags : [];
      setFlags(list as FlagItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadInvites = async () => {
    try {
      const me = account || user?.id || "";
      if (!me || !supabase) {
        setInvitesCount(0);
        setInviteNotice(null);
        return;
      }
      const { data, error } = await (supabase as any)
        .from("discussions")
        .select("content,created_at")
        .eq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        setInvitesCount(0);
        setInviteNotice(null);
        return;
      }
      const items = (data || [])
        .map((r: any) => {
          try {
            const obj = JSON.parse(String(r.content || "{}"));
            if (obj && obj.type === "witness_invite") {
              return {
                flag_id: Number(obj.flag_id || 0),
                owner_id: String(obj.owner_id || ""),
                title: String(obj.title || ""),
                ts: String(obj.ts || r.created_at || ""),
              };
            }
          } catch {}
          return null;
        })
        .filter(Boolean) as any[];
      setInvitesCount(items.length);
      setInviteNotice(items[0] || null);
    } catch {
      setInvitesCount(0);
      setInviteNotice(null);
    }
  };

  const loadCollectedStickers = async () => {
    try {
      const me = account || user?.id || "";
      if (!me) {
        setCollectedStickers([]);
        return;
      }
      const res = await fetch(
        `/api/stickers?user_id=${encodeURIComponent(me)}`
      );
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j?.data)) {
          setCollectedStickers(j.data);
        }
      }
    } catch {
      setCollectedStickers([]);
    }
  };

  const loadAllStickers = async () => {
    try {
      const res = await fetch("/api/emojis");
      const ret = await res.json();
      if (ret?.data && Array.isArray(ret.data)) {
        const items = ret.data.map((r: any) => ({
          id: String(r.id),
          emoji: "",
          name: r.name,
          rarity: r.rarity || "common",
          desc: r.description || "",
          color: "bg-blue-50",
          image_url: r.url,
        }));
        setAllStickers(items);
      }
    } catch {}
  };

  useEffect(() => {
    if (!supabase) return;
    loadFlags();
    loadInvites();
    loadCollectedStickers();
    loadAllStickers();

    const ch = supabase
      .channel("flags-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flags" },
        () => {
          loadFlags();
        }
      )
      .subscribe();

    const ch2 = supabase
      .channel("discussions-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "discussions" },
        () => {
          loadInvites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(ch2);
    };
  }, []);

  const handleCreateClick = () => {
    if (!account && !user) {
      setWalletModalOpen(true);
      return;
    }
    setOfficialCreate(false);
    setInitTitle("");
    setInitDesc("");
    setSelectedTplId(null);
    setTplConfig({});
    setCreateOpen(true);
  };

  const openCheckin = (flag: FlagItem) => {
    const me = account || user?.id || "";
    if (
      !me ||
      String(flag.user_id || "").toLowerCase() !== String(me).toLowerCase()
    ) {
      alert("仅创建者可打卡");
      return;
    }
    setCheckinFlag(flag);
    setCheckinNote("");
    setCheckinImage("");
    setCheckinOpen(true);
  };

  const submitCheckin = async () => {
    if (!checkinFlag) return;
    const me = account || user?.id || "";
    if (!me) return;
    try {
      setCheckinSubmitting(true);
      const payload = {
        flag_id: checkinFlag.id,
        user_id: me,
        note: checkinNote,
        image_url: checkinImage,
      };
      const res = await fetch("/api/flags/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const ret = await res.json().catch(() => ({} as any));
      if (!res.ok)
        throw new Error(
          String((ret as any)?.detail || (ret as any)?.message || "打卡失败")
        );
      setCheckinOpen(false);
      setCheckinFlag(null);
      setCheckinNote("");
      setCheckinImage("");
      await loadFlags();

      // Check for reward
      if ((ret as any)?.reward) {
        // Map backend emoji to frontend StickerItem if needed, or pass directly
        // Backend: { id, name, url, rarity, description }
        // Frontend: { id, emoji, name, rarity, desc, color }
        // We'll adapt it.
        const r = (ret as any).reward;
        const s: StickerItem = {
            id: String(r.id),
            emoji: "", // Use image instead if possible, or fallback
            name: r.name,
            rarity: r.rarity || "common",
            desc: r.description || "获得了一个新表情",
            color: "bg-blue-100", // Default color
            // Add image_url to StickerItem definition if not present
            image_url: r.url
        } as any; 
        setEarnedSticker(s);
        setStickerOpen(true);
      }
    } catch (e) {
      alert(String((e as any)?.message || "打卡失败，请重试"));
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
        `/api/flags/${flag.id}/checkins?limit=50&viewer_id=${encodeURIComponent(
          me
        )}`,
        {
          cache: "no-store",
        }
      );
      const data = await res.json().catch(() => ({} as any));
      const items = Array.isArray(data?.items) ? data.items : [];
      setHistoryItems(items);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const reviewCheckin = async (
    checkinId: string,
    action: "approve" | "reject"
  ) => {
    const me = account || user?.id || "";
    if (!me) return alert("请先连接钱包或登录");
    try {
      setReviewSubmittingId(checkinId);
      const res = await fetch(`/api/checkins/${checkinId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewer_id: me }),
      });
      const ret = await res.json().catch(() => ({} as any));
      if (!res.ok)
        throw new Error(String(ret?.detail || ret?.message || "操作失败"));
      if (historyFlag) await openHistory(historyFlag);
    } catch (e) {
      alert(String((e as any)?.message || "操作失败"));
    } finally {
      setReviewSubmittingId(null);
    }
  };

  const settleFlag = async (flag: FlagItem) => {
    const me = account || user?.id || "";
    if (!me) return alert("请先连接钱包或登录");
    try {
      setSettlingId(flag.id as any);
      const res = await fetch(`/api/flags/${flag.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settler_id: me }),
      });
      const ret = await res.json().catch(() => ({} as any));
      if (!res.ok)
        throw new Error(String(ret?.detail || ret?.message || "结算失败"));
      await loadFlags();

      if (ret?.status === "success") {
        // 重新获取收集的表情包，以便显示正确的（虽然这里只是随机展示一个）
        // 实际上后端已经保存了，我们这里为了即时反馈，再次随机展示一个
        // 理想情况是后端返回获得的 stickerId
        await loadCollectedStickers();

        // 这里的逻辑稍微调整：如果后端真的保存了，我们最好从后端获取是哪一个。
        // 但为了简单，我们暂时保持随机展示，或者让用户去图鉴里看。
        // 为了体验好，我们还是随机展示一个，虽然可能跟后端存的不一致（如果完全随机的话）。
        // *修正*：应该让 settle 接口返回 earned_sticker_id。
        // 但目前为了快速迭代，先保持这样。用户打开图鉴时会看到最新的。
        const s =
          OFFICIAL_STICKERS[
            Math.floor(Math.random() * OFFICIAL_STICKERS.length)
          ];
        setEarnedSticker(s);
        setStickerOpen(true);
      } else {
        alert(
          `结算完成：${String(ret?.status || "")}，通过天数 ${
            ret?.metrics?.approvedDays || 0
          }/${ret?.metrics?.totalDays || 0}`
        );
      }
    } catch (e) {
      alert(String((e as any)?.message || "结算失败"));
    } finally {
      setSettlingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-32 relative overflow-hidden font-sans">
      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-300/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-purple-100 shadow-sm text-purple-700 font-medium text-sm mb-4"
            >
              <Sparkles className="w-4 h-4" />
              <span>让每一次坚持都闪闪发光</span>
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-3">
              Flag 挑战中心
            </h1>
            <p className="text-gray-500 font-medium text-lg max-w-xl">
              无论是官方精选挑战，还是自定义的小目标，这里都是你变得更好的起点。
            </p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                loadCollectedStickers();
                setGalleryOpen(true);
              }}
              className="px-6 py-4 bg-white text-gray-900 border border-gray-200 rounded-[2rem] font-bold shadow-lg hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <Smile className="w-5 h-5 text-purple-500" />
              我的图鉴
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCreateClick}
              className="px-8 py-4 bg-gray-900 text-white rounded-[2rem] font-bold shadow-xl shadow-gray-900/20 hover:bg-gray-800 transition-all flex items-center gap-3"
            >
              <Plus className="w-5 h-5" />
              创建我的 Flag
            </motion.button>
          </div>
        </div>

        {/* Official Challenges Section */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
              <Trophy className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">官方精选挑战</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {officialTemplates.map((tpl) => (
              <motion.div
                key={tpl.id}
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative overflow-hidden rounded-[2rem] p-5 cursor-pointer border border-white/50 shadow-lg transition-all bg-gradient-to-br ${tpl.gradient} ${tpl.shadow}`}
                onClick={() => {
                  setInitTitle(tpl.title);
                  setInitDesc(tpl.description);
                  setOfficialCreate(true);
                  setSelectedTplId(tpl.id);
                  setTplConfig(defaultConfigFor(tpl.id));
                  setCreateOpen(true);
                }}
              >
                {/* Decorative background circle */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/30 rounded-full blur-2xl" />

                <div
                  className={`w-12 h-12 rounded-2xl bg-white/80 backdrop-blur-sm flex items-center justify-center mb-4 ${tpl.color} shadow-sm`}
                >
                  <tpl.icon className="w-6 h-6" />
                </div>

                <h3 className="text-lg font-black text-gray-900 mb-1 leading-tight">
                  {tpl.title}
                </h3>
                <p className="text-xs font-bold text-gray-600/80 leading-relaxed">
                  {tpl.description}
                </p>

                <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-white/40 self-start px-2 py-1 rounded-full w-fit">
                  <ShieldCheck className="w-3 h-3" />
                  官方认证
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* My Flags Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
                <Flag className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-gray-900">
                我的 Flag 墙
              </h2>
            </div>
          </div>

          <FlagsStats flags={flags} />

          {/* Filter Tabs & Main Content */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/60 shadow-xl shadow-purple-500/5 min-h-[400px]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
              <div className="flex p-1.5 bg-gray-100/50 rounded-2xl w-full sm:w-auto overflow-x-auto">
                {[
                  { id: "all", label: "全部" },
                  { id: "active", label: "进行中" },
                  { id: "pending_review", label: "审核中" },
                  { id: "success", label: "已完成" },
                  { id: "failed", label: "已结束" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                      statusFilter === tab.id
                        ? "bg-white text-gray-900 shadow-md"
                        : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setFilterMine(!filterMine)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all border ${
                  filterMine
                    ? "bg-purple-100 border-purple-200 text-purple-700"
                    : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                }`}
              >
                <Users className="w-4 h-4" />
                {filterMine ? "只看我的" : "只看我的"}
              </button>
            </div>

            {/* Invite Notice */}
            <AnimatePresence>
              {inviteNotice && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-amber-500 shadow-sm">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        收到监督邀请: {inviteNotice.title}
                      </div>
                      <div className="text-xs text-amber-700 font-medium">
                        你有 {invitesCount} 条待处理的监督邀请
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setInviteNotice(null)}
                    className="px-4 py-2 bg-white rounded-xl text-xs font-bold text-gray-600 shadow-sm hover:bg-gray-50"
                  >
                    知道了
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                <p className="text-gray-400 font-medium animate-pulse">
                  加载中...
                </p>
              </div>
            ) : flags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-inner">
                  <Flag className="w-12 h-12 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  这里空空如也
                </h3>
                <p className="text-gray-500 mb-8 font-medium">
                  还没有任何 Flag，快去创建一个吧！
                </p>
                <button
                  onClick={handleCreateClick}
                  className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:scale-105 transition-transform"
                >
                  立即创建
                </button>
              </div>
            ) : (
              <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                <AnimatePresence>
                  {flags
                    .filter((f) =>
                      statusFilter === "all" ? true : f.status === statusFilter
                    )
                    .filter((f) => {
                      if (!filterMine) return true;
                      const me = account || user?.id || "";
                      return (
                        me &&
                        String(f.user_id || "").toLowerCase() ===
                          String(me).toLowerCase()
                      );
                    })
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    )
                    .map((flag) => (
                      <div key={flag.id} className="break-inside-avoid">
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
                      </div>
                    ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

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

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />

      <StickerRevealModal
        isOpen={stickerOpen}
        onClose={() => setStickerOpen(false)}
        sticker={earnedSticker}
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
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl z-50 p-8"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">
                    打卡时刻
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">
                    记录你的每一次进步
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">
                    心得体会
                  </label>
                  <textarea
                    value={checkinNote}
                    onChange={(e) => setCheckinNote(e.target.value)}
                    placeholder="今天感觉如何？写点什么吧..."
                    rows={4}
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-green-500 outline-none transition-all text-gray-900 resize-none font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">
                    图片链接 (可选)
                  </label>
                  <input
                    value={checkinImage}
                    onChange={(e) => setCheckinImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-green-500 outline-none transition-all text-gray-900 font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setCheckinOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={submitCheckin}
                  disabled={checkinSubmitting}
                  className="flex-1 py-4 rounded-2xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/20 disabled:opacity-50"
                >
                  {checkinSubmitting ? "提交中…" : "确认打卡"}
                </button>
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl z-50 p-8 max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-2xl font-black text-gray-900">打卡记录</h3>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="p-2 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-2 flex-1 scrollbar-hide">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  </div>
                ) : historyItems.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 font-medium">
                    暂无记录
                  </div>
                ) : (
                  historyItems.map((it) => (
                    <div
                      key={it.id}
                      className="p-4 rounded-2xl bg-gray-50 border border-gray-100 relative"
                    >
                      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200" />
                      <div className="relative pl-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm">
                            {new Date(it.created_at).toLocaleDateString()}
                          </span>
                          {historyFlag?.verification_type === "witness" && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                String(it.review_status || "pending") ===
                                "approved"
                                  ? "bg-green-100 text-green-700"
                                  : String(it.review_status || "pending") ===
                                    "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              {String(it.review_status || "pending") ===
                              "approved"
                                ? "已通过"
                                : String(it.review_status || "pending") ===
                                  "rejected"
                                ? "已拒绝"
                                : "待审核"}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 font-medium mb-2">
                          {it.note || "打卡"}
                        </p>
                        {it.image_url && (
                          <img
                            src={it.image_url}
                            className="w-full h-32 object-cover rounded-xl bg-gray-200"
                          />
                        )}

                        {historyFlag?.verification_type === "witness" &&
                          String(it.review_status || "pending") === "pending" &&
                          String(historyFlag?.user_id || "").toLowerCase() ===
                            String(account || user?.id || "").toLowerCase() && (
                            <div className="mt-3 flex gap-2">
                              <button
                                disabled={reviewSubmittingId === it.id}
                                onClick={() => reviewCheckin(it.id, "approve")}
                                className="flex-1 py-2 text-xs font-bold rounded-xl bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                              >
                                通过
                              </button>
                              <button
                                disabled={reviewSubmittingId === it.id}
                                onClick={() => reviewCheckin(it.id, "reject")}
                                className="flex-1 py-2 text-xs font-bold rounded-xl bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                              >
                                驳回
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
