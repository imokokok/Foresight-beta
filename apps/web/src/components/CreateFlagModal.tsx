"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Calendar,
  Type,
  AlignLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  Droplet,
  Zap,
  BookOpen,
  Brain,
  Moon,
  Sun,
  Home,
  Ban,
  Camera,
  Flag,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";

interface CreateFlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultTemplateId?: string | null;
  defaultConfig?: any;
  defaultTitle?: string;
  defaultDesc?: string;
  isOfficial?: boolean;
}

// Map IDs to Icons/Colors for the modal display
const THEME_MAP: Record<string, { icon: any; color: string; bg: string }> = {
  early_morning: { icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
  drink_water_8: { icon: Droplet, color: "text-cyan-600", bg: "bg-cyan-100" },
  steps_10k: { icon: Zap, color: "text-emerald-600", bg: "bg-emerald-100" },
  read_20_pages: {
    icon: BookOpen,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
  },
  meditate_10m: { icon: Brain, color: "text-purple-600", bg: "bg-purple-100" },
  sleep_before_11: { icon: Moon, color: "text-slate-600", bg: "bg-slate-100" },
  no_sugar_day: { icon: Ban, color: "text-rose-600", bg: "bg-rose-100" },
  breakfast_photo: {
    icon: Camera,
    color: "text-orange-600",
    bg: "bg-orange-100",
  },
  sunlight_20m: { icon: Sun, color: "text-yellow-600", bg: "bg-yellow-100" },
  tidy_room_10m: { icon: Home, color: "text-teal-600", bg: "bg-teal-100" },
  default: { icon: Flag, color: "text-purple-600", bg: "bg-purple-100" },
};

export default function CreateFlagModal({
  isOpen,
  onClose,
  onSuccess,
  defaultTemplateId,
  defaultConfig,
  defaultTitle = "",
  defaultDesc = "",
  isOfficial = false,
}: CreateFlagModalProps) {
  const { account } = useWallet();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [desc, setDesc] = useState(defaultDesc);
  const [deadline, setDeadline] = useState("");
  const [verifType, setVerifType] = useState<"self" | "witness">("self");
  const [witnessId, setWitnessId] = useState("");

  // Update state when props change
  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setDesc(defaultDesc);
      setVerifType(isOfficial ? "witness" : "self");
      setDeadline("");
      setWitnessId("");
    }
  }, [isOpen, defaultTitle, defaultDesc, isOfficial]);

  // Construct final title/desc based on template config (if official)
  useEffect(() => {
    if (!isOfficial || !defaultTemplateId) return;
    const cfg = defaultConfig || {};
    let t = defaultTitle;
    let d = defaultDesc;

    if (defaultTemplateId === "early_morning") {
      const h = cfg.targetHour || 7;
      t = `早起 ${h}:00 打卡`;
      d = `目标：在 ${h}:00 前起床并打卡\n证明：晨间记录或照片`;
    } else if (defaultTemplateId === "drink_water_8") {
      const n = cfg.cups || 8;
      t = `喝水 ${n} 杯`;
      d = `目标：今日饮水 ${n} 杯\n证明：记录或照片`;
    } else if (defaultTemplateId === "steps_10k") {
      const n = cfg.steps || 10000;
      t = `步数 ≥ ${n}`;
      d = `目标：当日步数不低于 ${n}\n证明：设备截图`;
    } else if (defaultTemplateId === "read_20_pages") {
      const n = cfg.pages || 20;
      t = `阅读 ${n} 页`;
      d = `目标：今日阅读 ${n} 页\n证明：书名与页码`;
    } else if (defaultTemplateId === "meditate_10m") {
      const m = cfg.minutes || 10;
      t = `冥想 ${m} 分钟`;
      d = `目标：冥想 ${m} 分钟\n证明：计时或截图`;
    } else if (defaultTemplateId === "sleep_before_11") {
      const h = cfg.beforeHour || 23;
      t = `在 ${h}:00 前睡觉`;
      d = `目标：当日 ${h}:00 前就寝\n证明：记录或应用截图`;
    } else if (defaultTemplateId === "sunlight_20m") {
      const m = cfg.minutes || 20;
      t = `晒太阳 ${m} 分钟`;
      d = `目标：日晒 ${m} 分钟\n证明：地点与时长`;
    } else if (defaultTemplateId === "tidy_room_10m") {
      const m = cfg.minutes || 10;
      t = `整理房间 ${m} 分钟`;
      d = `目标：整理至少 ${m} 分钟\n证明：前后对比图`;
    }

    setTitle(t);
    setDesc(d);
  }, [defaultTemplateId, defaultConfig, isOfficial, defaultTitle, defaultDesc]);

  const handleSubmit = async () => {
    if (!user && !account) return;
    try {
      setLoading(true);
      const payload: any = {
        user_id: account || user?.id || "anonymous",
        title: title,
        description: desc,
        deadline: deadline,
        verification_type: isOfficial ? "witness" : verifType,
        status: "active",
      };

      if (isOfficial) {
        payload.witness_id = "official";
      } else if (verifType === "witness" && witnessId.trim()) {
        payload.witness_id = witnessId.trim();
      }

      const res = await fetch("/api/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Create failed");
      onSuccess();
      onClose();
    } catch (e) {
      alert("创建失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const theme = THEME_MAP[defaultTemplateId || ""] || THEME_MAP.default;
  const Icon = theme.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-purple-500/10 z-50 p-8 overflow-hidden max-h-[90vh] overflow-y-auto border border-white/50"
          >
            {/* Background Gradient Decoration */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-50/50 to-transparent pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between mb-8 z-10">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${
                    isOfficial ? theme.bg : "bg-purple-50"
                  } ${isOfficial ? theme.color : "text-purple-600"}`}
                >
                  {isOfficial ? (
                    <Icon className="w-7 h-7" />
                  ) : (
                    <Sparkles className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                    {isOfficial ? "加入挑战" : "创建 Flag"}
                  </h2>
                  <p className="text-gray-500 font-medium text-sm">
                    {isOfficial
                      ? "和大家一起坚持，见证更好的自己"
                      : "设定一个小目标，迈出第一步"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 rounded-full hover:bg-gray-100/80 transition-colors backdrop-blur-sm"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* Form Content */}
            <div className="space-y-6 relative z-10">
              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                  <Type className="w-4 h-4 text-purple-500" />
                  Flag 名称
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  readOnly={isOfficial} // Official titles are usually fixed or pre-generated
                  className={`w-full px-5 py-4 rounded-2xl bg-gray-50/50 border border-gray-100 outline-none transition-all font-bold text-lg text-gray-900 placeholder:text-gray-300 hover:bg-white hover:border-purple-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-50 ${
                    isOfficial ? "opacity-80 cursor-default" : ""
                  }`}
                  placeholder="例如：每天背10个单词"
                />
              </div>

              {/* Description Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-purple-500" />
                  详细描述 & 规则
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  readOnly={isOfficial}
                  rows={3}
                  className={`w-full px-5 py-4 rounded-2xl bg-gray-50/50 border border-gray-100 outline-none transition-all text-gray-600 resize-none font-medium placeholder:text-gray-300 hover:bg-white hover:border-purple-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-50 ${
                    isOfficial ? "opacity-80 cursor-default" : ""
                  }`}
                  placeholder="写下你的具体的执行计划..."
                />
              </div>

              {/* Verification Type Selection (Only for Custom) */}
              {!isOfficial && (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    监督方式
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setVerifType("self")}
                      className={`relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 group ${
                        verifType === "self"
                          ? "border-purple-500 bg-purple-50/50 text-purple-700 shadow-sm"
                          : "border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/30 text-gray-500"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                          verifType === "self"
                            ? "bg-purple-100 text-purple-600"
                            : "bg-gray-100 text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-500"
                        }`}
                      >
                        <UserCheck className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-sm mb-0.5">自觉打卡</div>
                        <div className="text-[10px] opacity-70 font-medium">
                          我相信我的自律
                        </div>
                      </div>
                      {verifType === "self" && (
                        <div className="absolute top-3 right-3 text-purple-500">
                          <CheckCircle2 className="w-5 h-5 fill-purple-100" />
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setVerifType("witness")}
                      className={`relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 group ${
                        verifType === "witness"
                          ? "border-purple-500 bg-purple-50/50 text-purple-700 shadow-sm"
                          : "border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/30 text-gray-500"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                          verifType === "witness"
                            ? "bg-purple-100 text-purple-600"
                            : "bg-gray-100 text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-500"
                        }`}
                      >
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-sm mb-0.5">好友监督</div>
                        <div className="text-[10px] opacity-70 font-medium">
                          邀请好友审核
                        </div>
                      </div>
                      {verifType === "witness" && (
                        <div className="absolute top-3 right-3 text-purple-500">
                          <CheckCircle2 className="w-5 h-5 fill-purple-100" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Witness ID Input (Only if Witness selected) */}
              {!isOfficial && verifType === "witness" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2"
                >
                  <label className="text-sm font-bold text-gray-700 ml-1">
                    监督人 ID / 地址
                  </label>
                  <input
                    value={witnessId}
                    onChange={(e) => setWitnessId(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50/50 border border-gray-100 outline-none transition-all font-mono text-sm text-gray-900 placeholder:text-gray-400 hover:bg-white hover:border-purple-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-50"
                    placeholder="输入好友的用户ID或钱包地址"
                  />
                </motion.div>
              )}

              {/* Deadline (Optional for both, but usually hidden for official templates if not configured) */}
              {!isOfficial && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    截止日期 (可选)
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50/50 border border-gray-100 outline-none transition-all text-gray-900 font-medium hover:bg-white hover:border-purple-200 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-50"
                  />
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex gap-4 relative z-10">
              <button
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || (!title && !isOfficial)}
                className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {isOfficial ? "确认加入" : "创建 Flag"}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
