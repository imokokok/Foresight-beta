"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { getClient } from "@/lib/supabase";
import WalletModal from "@/components/WalletModal";
import {
  Loader2,
  Flag,
  Calendar,
  CheckCircle2,
  Users,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type FlagItem = {
  id: number;
  title: string;
  description: string;
  deadline: string;
  status: "active" | "pending_review" | "success" | "failed";
  verification_type: "self" | "witness";
  proof_image_url?: string;
  created_at: string;
};

export default function FlagsPage() {
  const { account } = useWallet();
  const { user } = useAuth();
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [verifType, setVerifType] = useState<"self" | "witness">("self");
  const [submitting, setSubmitting] = useState(false);

  const supabase = getClient();

  const loadFlags = async () => {
    try {
      setLoading(true);
      if (!supabase) return;
      // For now, just load all flags. In future, filter by user_id if needed for privacy
      const { data, error } = await supabase
        .from("flags")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setFlags(data as FlagItem[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) return;
    loadFlags();

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

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const handleCreateClick = () => {
    if (!account && !user) {
      setWalletModalOpen(true);
      return;
    }
    setCreateOpen(true);
  };

  const createFlag = async () => {
    if (!newTitle.trim() || !newDeadline) return;
    if (!user && !account) return; // simple check
    if (!supabase) return;

    try {
      setSubmitting(true);
      const payload = {
        user_id: account || user?.id || "anonymous", // Prefer wallet, fallback to user id
        title: newTitle,
        description: newDesc,
        deadline: new Date(newDeadline).toISOString(),
        verification_type: verifType,
        status: "active",
      };

      const { error } = await supabase.from("flags").insert(payload);
      if (error) throw error;

      setCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewDeadline("");
    } catch (e) {
      alert("创建失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pb-20">
      <div className="max-w-5xl mx-auto px-4 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Flag className="w-8 h-8 text-purple-600" />
              我的 Flag
            </h1>
            <p className="text-gray-500 mt-1">立下目标，见证改变</p>
          </div>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 duration-200"
          >
            <Plus className="w-5 h-5" />
            立个 Flag
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : flags.length === 0 ? (
          <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200">
            <Flag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">还没有 Flag</h3>
            <p className="text-gray-500 mb-6">今天想挑战什么？</p>
            <button
              onClick={handleCreateClick}
              className="px-6 py-2 bg-white border border-purple-200 text-purple-600 rounded-full hover:bg-purple-50 transition-colors"
            >
              开始第一个挑战
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flags.map((flag) => (
              <FlagCard key={flag.id} flag={flag} />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {createOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
              onClick={() => setCreateOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-50 p-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                立个 Flag 🚩
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    我想...
                  </label>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例如：明天早起跑步"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    备注 (可选)
                  </label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="具体怎么做？"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    截止时间
                  </label>
                  <input
                    type="datetime-local"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    监督方式
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setVerifType("self")}
                      className={`px-4 py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                        verifType === "self"
                          ? "bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-medium">自己打卡</span>
                      <span className="text-xs opacity-70">上传照片即可</span>
                    </button>
                    <button
                      onClick={() => setVerifType("witness")}
                      className={`px-4 py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                        verifType === "witness"
                          ? "bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-medium">好友监督</span>
                      <span className="text-xs opacity-70">邀请好友见证</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={createFlag}
                  disabled={submitting || !newTitle || !newDeadline}
                  className="flex-1 px-4 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "确认发布"
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </div>
  );
}

function FlagCard({ flag }: { flag: FlagItem }) {
  const statusConfig = {
    active: { color: "text-blue-600", bg: "bg-blue-50", label: "进行中" },
    pending_review: {
      color: "text-orange-600",
      bg: "bg-orange-50",
      label: "审核中",
    },
    success: { color: "text-green-600", bg: "bg-green-50", label: "挑战成功" },
    failed: { color: "text-red-600", bg: "bg-red-50", label: "挑战失败" },
  };

  const s = statusConfig[flag.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group"
    >
      <div className="flex justify-between items-start mb-3">
        <span
          className={`text-xs font-bold px-2 py-1 rounded-lg ${s.bg} ${s.color}`}
        >
          {s.label}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          {flag.verification_type === "self" ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <Users className="w-3 h-3" />
          )}
          {flag.verification_type === "self" ? "自律" : "监督"}
        </span>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
        {flag.title}
      </h3>
      {flag.description && (
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {flag.description}
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400 mt-auto pt-4 border-t border-gray-50">
        <Calendar className="w-3 h-3" />
        截止: {new Date(flag.deadline).toLocaleString()}
      </div>

      {/* Hover Action - Mockup for now */}
      <div className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
        {flag.status === "active" && (
          <button className="px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-medium shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
            去打卡
          </button>
        )}
      </div>
    </motion.div>
  );
}
