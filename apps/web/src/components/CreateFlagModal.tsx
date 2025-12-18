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
import DatePicker from "@/components/ui/DatePicker";
import { toast } from "@/lib/toast";

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
    if (!user && !account) {
      toast.warning("需要连接钱包", "请先连接钱包才能创建 Flag");
      return;
    }

    // 必填项校验
    if (!title.trim()) {
      toast.warning("标题不能为空", "请输入 Flag 标题");
      return;
    }

    if (verifType === "witness" && !witnessId.trim() && !isOfficial) {
      toast.warning("见证人信息缺失", "请填写见证人 ID 或地址");
      return;
    }

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
      } else if (verifType === "self") {
        // Explicitly set self verification
        payload.verification_type = "self";
        // Ensure no witness_id is set
        delete payload.witness_id;
      }

      const res = await fetch("/api/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Create failed");
      toast.success("创建成功", "Flag 已创建，快去打卡吧！");
      onSuccess();
      onClose();
    } catch (e) {
      toast.error("创建失败", "请检查网络连接后重试");
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#FAFAFA] rounded-[2rem] shadow-2xl shadow-purple-500/10 z-50 p-0 overflow-hidden max-h-[90vh] overflow-y-auto border-[6px] border-white"
          >
            {/* Paper Texture Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />

            {/* Tape Effect */}
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-purple-200/80 backdrop-blur-sm rotate-1 z-50 shadow-sm mask-tape"
              style={{ clipPath: "polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)" }}
            />

            {/* Header Image Area */}
            <div className="relative h-32 bg-gradient-to-br from-purple-100 to-pink-50 p-8 flex items-end">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
              <div
                className="absolute top-4 right-4 p-2 rounded-full bg-white/50 backdrop-blur-md cursor-pointer hover:bg-white transition-colors z-20"
                onClick={onClose}
              >
                <X className="w-5 h-5 text-gray-500" />
              </div>

              {/* Giant Icon Decoration */}
              <div className="absolute -bottom-6 -right-6 opacity-20 rotate-12">
                {isOfficial ? (
                  <Icon className="w-40 h-40 text-purple-600" />
                ) : (
                  <Sparkles className="w-40 h-40 text-purple-600" />
                )}
              </div>

              <div className="relative z-10 flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md border-4 border-white flex items-center justify-center transform -rotate-3">
                  {isOfficial ? (
                    <Icon className={`w-8 h-8 ${theme.color}`} />
                  ) : (
                    <Sparkles className="w-8 h-8 text-purple-500" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-800 tracking-tight leading-none mb-1">
                    {isOfficial ? "Join Challenge" : "New Flag"}
                  </h2>
                  <p className="text-sm font-bold text-gray-500 opacity-80">
                    {isOfficial ? "Let's do this together!" : "Start your journey today"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 relative z-10">
              {/* Form Content */}
              <div className="space-y-6">
                {/* Title Input */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                    Flag Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    readOnly={isOfficial}
                    className={`w-full px-5 py-4 rounded-xl bg-white border-2 border-gray-100 outline-none transition-all font-bold text-lg text-gray-800 placeholder:text-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-50 shadow-sm ${
                      isOfficial ? "opacity-80 cursor-default bg-gray-50" : ""
                    }`}
                    placeholder="e.g. Read 10 pages daily"
                  />
                </div>

                {/* Description Input */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                    Details & Rules
                  </label>
                  <textarea
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    readOnly={isOfficial}
                    rows={3}
                    className={`w-full px-5 py-4 rounded-xl bg-white border-2 border-gray-100 outline-none transition-all text-gray-600 resize-none font-medium placeholder:text-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-50 shadow-sm ${
                      isOfficial ? "opacity-80 cursor-default bg-gray-50" : ""
                    }`}
                    placeholder="Describe your plan..."
                  />
                </div>

                {/* Verification Type Selection */}
                {!isOfficial && (
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                      Verification
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setVerifType("self")}
                        className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${
                          verifType === "self"
                            ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm"
                            : "border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/30 text-gray-400"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${verifType === "self" ? "bg-purple-200 text-purple-700" : "bg-gray-100"}`}
                        >
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-sm">Self Check</div>
                        </div>
                        {verifType === "self" && (
                          <div className="absolute top-2 right-2 text-purple-500">
                            <CheckCircle2 className="w-4 h-4 fill-purple-100" />
                          </div>
                        )}
                      </button>

                      <button
                        onClick={() => setVerifType("witness")}
                        className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${
                          verifType === "witness"
                            ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm"
                            : "border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/30 text-gray-400"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${verifType === "witness" ? "bg-purple-200 text-purple-700" : "bg-gray-100"}`}
                        >
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-sm">Friend Check</div>
                        </div>
                        {verifType === "witness" && (
                          <div className="absolute top-2 right-2 text-purple-500">
                            <CheckCircle2 className="w-4 h-4 fill-purple-100" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Witness ID Input */}
                {!isOfficial && verifType === "witness" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2"
                  >
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider ml-1">
                      Witness ID / Address
                    </label>
                    <input
                      value={witnessId}
                      onChange={(e) => setWitnessId(e.target.value)}
                      className="w-full px-5 py-4 rounded-xl bg-white border-2 border-gray-100 outline-none transition-all font-mono text-sm text-gray-900 placeholder:text-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-50 shadow-sm"
                      placeholder="Enter friend's ID or Address"
                    />
                  </motion.div>
                )}

                {/* Deadline */}
                {!isOfficial && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                      Target Date (Optional)
                    </label>
                    <DatePicker
                      value={deadline}
                      onChange={setDeadline}
                      placeholder="Select Date"
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="mt-8 pt-6 border-t border-dashed border-gray-200 flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-xl bg-white border-2 border-gray-100 text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3.5 rounded-xl bg-gray-900 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {isOfficial ? "Join Now" : "Create Flag"}
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
