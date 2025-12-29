"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
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
  Heart,
  Star,
  Compass,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import DatePicker from "@/components/ui/DatePicker";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n";

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

// Map IDs to Icons/Colors/Mascot-style gradients
const THEME_MAP: Record<
  string,
  { icon: any; color: string; bg: string; gradient: string; emoji: string }
> = {
  early_morning: {
    icon: Clock,
    color: "text-orange-500",
    bg: "bg-orange-50",
    gradient: "from-[#FF8C42] via-[#FFAA5A] to-[#FFD56B]",
    emoji: "🌅",
  },
  drink_water_8: {
    icon: Droplet,
    color: "text-blue-500",
    bg: "bg-blue-50",
    gradient: "from-[#4FACFE] via-[#00F2FE] to-[#70E1F5]",
    emoji: "💧",
  },
  steps_10k: {
    icon: Zap,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    gradient: "from-[#43E97B] via-[#38F9D7] to-[#5EEAD4]",
    emoji: "🏃",
  },
  read_20_pages: {
    icon: BookOpen,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    gradient: "from-[#667EEA] via-[#764BA2] to-[#6B8DFF]",
    emoji: "📖",
  },
  meditate_10m: {
    icon: Brain,
    color: "text-purple-500",
    bg: "bg-purple-50",
    gradient: "from-[#A18CD1] via-[#FBC2EB] to-[#E2D1F9]",
    emoji: "🧘",
  },
  sleep_before_11: {
    icon: Moon,
    color: "text-slate-500",
    bg: "bg-slate-50",
    gradient: "from-[#2C3E50] via-[#4CA1AF] to-[#2C3E50]",
    emoji: "🌙",
  },
  no_sugar_day: {
    icon: Ban,
    color: "text-rose-500",
    bg: "bg-rose-50",
    gradient: "from-[#F093FB] via-[#F5576C] to-[#FF8ED0]",
    emoji: "🍎",
  },
  breakfast_photo: {
    icon: Camera,
    color: "text-amber-500",
    bg: "bg-amber-50",
    gradient: "from-[#F6D365] via-[#FDA085] to-[#F6D365]",
    emoji: "🍳",
  },
  sunlight_20m: {
    icon: Sun,
    color: "text-yellow-500",
    bg: "bg-yellow-50",
    gradient: "from-[#FCEEB5] via-[#FAD0C4] to-[#FFD1FF]",
    emoji: "☀️",
  },
  tidy_room_10m: {
    icon: Home,
    color: "text-teal-500",
    bg: "bg-teal-50",
    gradient: "from-[#13547A] via-[#80D0C7] to-[#13547A]",
    emoji: "🏠",
  },
  default: {
    icon: Flag,
    color: "text-violet-600",
    bg: "bg-violet-50",
    gradient: "from-[#7F56D9] via-[#9E77ED] to-[#6941C6]",
    emoji: "✨",
  },
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
  const tFlags = useTranslations("flags");

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [desc, setDesc] = useState(defaultDesc);
  const [deadline, setDeadline] = useState("");
  const [verifType, setVerifType] = useState<"self" | "witness">("self");
  const [witnessId, setWitnessId] = useState("");

  // Step state for multi-stage feel
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setDesc(defaultDesc);
      setVerifType(isOfficial ? "witness" : "self");
      setDeadline("");
      setWitnessId("");
      setStep(1);
    }
  }, [isOpen, defaultTitle, defaultDesc, isOfficial]);

  useEffect(() => {
    if (!isOfficial || !defaultTemplateId) return;
    const cfg = defaultConfig || {};
    let t = defaultTitle;
    let d = defaultDesc;

    const baseTitle = tFlags(`modal.templates.${defaultTemplateId}.title`);
    const baseDesc = tFlags(`modal.templates.${defaultTemplateId}.desc`);

    if (defaultTemplateId === "early_morning") {
      const h = cfg.targetHour || 7;
      t = baseTitle.replace("{hour}", String(h));
      d = baseDesc.replace("{hour}", String(h));
    } else if (defaultTemplateId === "drink_water_8") {
      const n = cfg.cups || 8;
      t = baseTitle.replace("{cups}", String(n));
      d = baseDesc.replace("{cups}", String(n));
    } else if (defaultTemplateId === "steps_10k") {
      const n = cfg.steps || 10000;
      t = baseTitle.replace("{steps}", String(n));
      d = baseDesc.replace("{steps}", String(n));
    } else if (defaultTemplateId === "read_20_pages") {
      const n = cfg.pages || 20;
      t = baseTitle.replace("{pages}", String(n));
      d = baseDesc.replace("{pages}", String(n));
    } else if (defaultTemplateId === "meditate_10m") {
      const m = cfg.minutes || 10;
      t = baseTitle.replace("{minutes}", String(m));
      d = baseDesc.replace("{minutes}", String(m));
    } else if (defaultTemplateId === "sleep_before_11") {
      const h = cfg.beforeHour || 23;
      t = baseTitle.replace("{hour}", String(h));
      d = baseDesc.replace("{hour}", String(h));
    } else if (defaultTemplateId === "sunlight_20m") {
      const m = cfg.minutes || 20;
      t = baseTitle.replace("{minutes}", String(m));
      d = baseDesc.replace("{minutes}", String(m));
    } else if (defaultTemplateId === "tidy_room_10m") {
      const m = cfg.minutes || 10;
      t = baseTitle.replace("{minutes}", String(m));
      d = baseDesc.replace("{minutes}", String(m));
    }

    setTitle(t);
    setDesc(d);
  }, [defaultTemplateId, defaultConfig, isOfficial, defaultTitle, defaultDesc, tFlags]);

  const handleSubmit = async () => {
    if (!user && !account) {
      toast.warning(tFlags("toast.walletRequiredTitle"), tFlags("toast.walletRequiredDesc"));
      return;
    }
    if (!title.trim()) {
      toast.warning(tFlags("toast.titleRequiredTitle"), tFlags("toast.titleRequiredDesc"));
      return;
    }
    if (verifType === "witness" && !witnessId.trim() && !isOfficial) {
      toast.warning(tFlags("toast.witnessRequiredTitle"), tFlags("toast.witnessRequiredDesc"));
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
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
        payload.verification_type = "self";
        delete payload.witness_id;
      }

      const res = await fetch("/api/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Create failed");
      toast.success(tFlags("toast.createSuccessTitle"), tFlags("toast.createSuccessDesc"));
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(tFlags("toast.createFailedTitle"), tFlags("toast.createFailedDesc"));
    } finally {
      setLoading(false);
    }
  };

  const theme = THEME_MAP[defaultTemplateId || ""] || THEME_MAP.default;
  const Icon = theme.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
          {/* Backdrop with animated pulse */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/40 backdrop-blur-3xl"
            onClick={onClose}
          >
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] pointer-events-none" />
          </motion.div>

          <motion.div
            layoutId="modal-container"
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 40 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col md:flex-row border border-white h-auto max-h-[90vh]"
          >
            {/* Left Decor Area - The "Vibe" Panel */}
            <div
              className={`w-full md:w-56 bg-gradient-to-br ${theme.gradient} p-8 flex flex-col justify-between relative overflow-hidden shrink-0`}
            >
              {/* Mesh Gradient Effect Overlay */}
              <div className="absolute inset-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-white/30 rounded-full blur-[60px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-black/10 rounded-full blur-[50px]" />
              </div>

              <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none" />
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />

              <motion.div
                initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="relative z-10 flex flex-col items-center md:items-start"
              >
                <div className="w-16 h-16 rounded-[1.5rem] bg-white/95 shadow-2xl flex items-center justify-center mb-6 border border-white/20 transform hover:scale-110 transition-transform">
                  <Icon className={`w-8 h-8 ${theme.color}`} />
                </div>
                <div className="text-4xl mb-4 filter drop-shadow-lg">{theme.emoji}</div>
                <h3 className="text-white font-black text-xl leading-tight tracking-tight drop-shadow-sm hidden md:block">
                  {isOfficial ? "同行者" : "梦想家"}
                </h3>
              </motion.div>

              <div className="relative z-10 hidden md:block">
                <div className="flex gap-1.5 mb-2">
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: step >= i ? 1 : 0.3, scale: step === i ? 1.2 : 1 }}
                      className="w-2 h-2 rounded-full bg-white"
                    />
                  ))}
                </div>
                <p className="text-[10px] text-white/80 font-black uppercase tracking-[0.2em]">
                  {step === 1 ? "第一步：播种" : step === 2 ? "第二步：呵护" : "第三步：启航"}
                </p>
              </div>

              {/* Floating bubbles animation */}
              <motion.div
                animate={{ y: [0, -20, 0], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-10 -right-5 w-32 h-32 rounded-full bg-white/20 blur-2xl"
              />
            </div>

            {/* Right Content Area */}
            <div className="flex-1 flex flex-col relative h-full min-h-[500px]">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2.5 rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all z-20 group"
              >
                <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              </button>

              <div className="p-8 md:p-12 flex-1 overflow-y-auto custom-scrollbar">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-10"
                >
                  {step === 1 && (
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                          {isOfficial
                            ? tFlags("modal.header.joinChallengeTitle")
                            : tFlags("modal.header.newFlagTitle")}
                        </h2>
                        <p className="text-gray-400 font-bold text-sm">
                          {isOfficial
                            ? tFlags("modal.header.joinChallengeSubtitle")
                            : tFlags("modal.header.newFlagSubtitle")}
                        </p>
                      </div>

                      <div className="space-y-6">
                        <div className="group space-y-3">
                          <label className="text-[10px] font-black text-purple-500/60 uppercase tracking-[0.3em] ml-1 flex items-center gap-2 group-focus-within:text-purple-500 transition-colors">
                            <Star className="w-3 h-3 fill-current" />
                            {tFlags("modal.form.titleLabel")}
                          </label>
                          <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            readOnly={isOfficial}
                            className="w-full px-0 py-2 border-b-2 border-gray-100 bg-transparent outline-none transition-all font-black text-2xl text-gray-900 placeholder:text-gray-200 focus:border-purple-500"
                            placeholder={tFlags("modal.form.titlePlaceholder")}
                          />
                        </div>

                        <div className="group space-y-3">
                          <label className="text-[10px] font-black text-purple-500/60 uppercase tracking-[0.3em] ml-1 flex items-center gap-2 group-focus-within:text-purple-500 transition-colors">
                            <Heart className="w-3 h-3 fill-current" />
                            {tFlags("modal.form.descLabel")}
                          </label>
                          <textarea
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            readOnly={isOfficial}
                            rows={2}
                            className="w-full px-0 py-2 border-b-2 border-gray-100 bg-transparent outline-none transition-all font-bold text-lg text-gray-600 resize-none placeholder:text-gray-200 focus:border-purple-500"
                            placeholder={tFlags("modal.form.descPlaceholder")}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
                          我们要如何见证呢？🤝
                        </h2>
                        <p className="text-gray-400 font-bold text-sm">
                          选择一种最能给你动力的方式
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <button
                          onClick={() => setVerifType("self")}
                          className={`flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all group ${
                            verifType === "self"
                              ? "bg-purple-50/50 border-purple-500 shadow-xl shadow-purple-500/5"
                              : "bg-white border-gray-50 hover:border-purple-100"
                          }`}
                        >
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                              verifType === "self"
                                ? "bg-purple-500 text-white"
                                : "bg-gray-50 text-gray-400"
                            }`}
                          >
                            <UserCheck className="w-7 h-7" />
                          </div>
                          <div className="text-left flex-1">
                            <div className="font-black text-gray-900 text-lg leading-none mb-1">
                              {tFlags("modal.form.selfCheck")}
                            </div>
                            <div className="text-xs text-gray-400 font-bold">
                              对自己诚实，是最酷的事
                            </div>
                          </div>
                          {verifType === "self" && (
                            <CheckCircle2 className="w-6 h-6 text-purple-500" />
                          )}
                        </button>

                        <button
                          onClick={() => setVerifType("witness")}
                          className={`flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all group ${
                            verifType === "witness"
                              ? "bg-fuchsia-50/50 border-fuchsia-500 shadow-xl shadow-fuchsia-500/5"
                              : "bg-white border-gray-50 hover:border-fuchsia-100"
                          }`}
                        >
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                              verifType === "witness"
                                ? "bg-fuchsia-500 text-white"
                                : "bg-gray-50 text-gray-400"
                            }`}
                          >
                            <ShieldCheck className="w-7 h-7" />
                          </div>
                          <div className="text-left flex-1">
                            <div className="font-black text-gray-900 text-lg leading-none mb-1">
                              {tFlags("modal.form.friendCheck")}
                            </div>
                            <div className="text-xs text-gray-400 font-bold">
                              找个靠谱的死党，互相监督
                            </div>
                          </div>
                          {verifType === "witness" && (
                            <CheckCircle2 className="w-6 h-6 text-fuchsia-500" />
                          )}
                        </button>
                      </div>

                      <AnimatePresence>
                        {verifType === "witness" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3"
                          >
                            <label className="text-[10px] font-black text-fuchsia-500/60 uppercase tracking-[0.3em] ml-1">
                              {tFlags("modal.form.witnessLabel")}
                            </label>
                            <input
                              value={witnessId}
                              onChange={(e) => setWitnessId(e.target.value)}
                              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent outline-none focus:bg-white focus:border-fuchsia-200 transition-all font-mono text-sm font-bold"
                              placeholder={tFlags("modal.form.witnessPlaceholder")}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
                          最后，定个期限吧 📅
                        </h2>
                        <p className="text-gray-400 font-bold text-sm">给未来一点小小的仪式感</p>
                      </div>

                      <div className="space-y-6">
                        <div className="p-2 bg-gray-50 rounded-[2.5rem]">
                          <DatePicker
                            value={deadline}
                            onChange={setDeadline}
                            placeholder={tFlags("modal.form.targetDatePlaceholder")}
                            className="w-full"
                          />
                        </div>

                        <div className="bg-purple-50/50 p-6 rounded-[2rem] flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
                            <Compass className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-black text-purple-900">准备好了吗？</div>
                            <div className="text-xs text-purple-600 font-bold">
                              设定目标后，我们将一路陪在你身边
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Footer Actions */}
              <div className="p-8 md:p-12 pt-0 flex gap-4 mt-auto">
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="flex-1 py-4.5 rounded-2xl bg-gray-50 text-gray-400 font-black text-sm hover:bg-gray-100 transition-all active:scale-95"
                  >
                    返回
                  </button>
                )}

                {step < 3 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    className="flex-[2] py-4.5 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-purple-600 transition-all shadow-xl shadow-purple-500/10 active:scale-95 flex items-center justify-center gap-2 group"
                  >
                    下一步
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-[2] py-4.5 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-purple-600 transition-all shadow-xl shadow-purple-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 group relative overflow-hidden"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {isOfficial
                          ? tFlags("modal.footer.joinNow")
                          : tFlags("modal.footer.createFlag")}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
