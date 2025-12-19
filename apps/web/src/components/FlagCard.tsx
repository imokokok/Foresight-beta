import { memo } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  Target,
  Users,
  Sparkles,
  MoreHorizontal,
  ArrowUpRight,
  Flame,
  CalendarDays,
  Camera,
} from "lucide-react";
import LazyImage from "@/components/ui/LazyImage";

export type FlagItem = {
  id: number;
  title: string;
  description: string;
  deadline: string;
  status: "active" | "pending_review" | "success" | "failed";
  verification_type: "self" | "witness";
  proof_image_url?: string;
  proof_comment?: string;
  created_at: string;
  user_id: string;
  witness_id?: string;
};

interface FlagCardProps {
  flag: FlagItem;
  isMine?: boolean;
  onCheckin?: () => void;
  onViewHistory?: () => void;
  onSettle?: () => void;
}

export const FlagCard = memo(function FlagCard({
  flag,
  isMine,
  onCheckin,
  onViewHistory,
  onSettle,
}: FlagCardProps) {
  const statusConfig = {
    active: {
      color: "text-emerald-800",
      bg: "bg-emerald-100",
      border: "border-emerald-200",
      label: "进行中",
      icon: Target,
      gradient: "from-emerald-100 to-teal-50",
      shadow: "shadow-emerald-500/20",
      cardBg: "bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30",
    },
    pending_review: {
      color: "text-amber-800",
      bg: "bg-amber-100",
      border: "border-amber-200",
      label: "审核中",
      icon: Clock,
      gradient: "from-amber-100 to-orange-50",
      shadow: "shadow-amber-500/20",
      cardBg: "bg-gradient-to-br from-amber-50 via-white to-amber-50/30",
    },
    success: {
      color: "text-blue-800",
      bg: "bg-blue-100",
      border: "border-blue-200",
      label: "挑战成功",
      icon: CheckCircle2,
      gradient: "from-blue-100 to-indigo-50",
      shadow: "shadow-blue-500/20",
      cardBg: "bg-gradient-to-br from-blue-50 via-white to-blue-50/30",
    },
    failed: {
      color: "text-rose-800",
      bg: "bg-rose-100",
      border: "border-rose-200",
      label: "挑战失败",
      icon: Users,
      gradient: "from-rose-100 to-red-50",
      shadow: "shadow-rose-500/20",
      cardBg: "bg-gradient-to-br from-rose-50 via-white to-rose-50/30",
    },
  };

  const s = statusConfig[flag.status];
  const StatusIcon = s.icon;

  const calculateStats = () => {
    // ... existing logic ...
    const start = new Date(flag.created_at).getTime();
    const end = new Date(flag.deadline).getTime();
    const now = Date.now();

    const totalDuration = end - start;
    const elapsed = now - start;

    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    const daysActive = Math.ceil(elapsed / (1000 * 60 * 60 * 24));

    const msLeft = end - now;
    let remainText = "已结束";
    if (msLeft > 0) {
      const d = Math.floor(msLeft / 86400000);
      const h = Math.floor((msLeft % 86400000) / 3600000);
      remainText = d > 0 ? `剩 ${d} 天` : `剩 ${h} 小时`;
    }

    return { progress, daysActive, remainText };
  };

  const { progress, daysActive, remainText } = calculateStats();

  // Random rotation for "sticker/photo" vibe
  const rotate = Math.random() * 2 - 1;

  // Sticker Decoration (Randomly shown)
  const showSticker = Math.random() > 0.6;
  const stickerType = Math.random() > 0.5 ? "star" : "heart";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, rotate: rotate }}
      exit={{ opacity: 0, scale: 0.5 }}
      whileHover={{ scale: 1.03, rotate: 0, zIndex: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative h-full cursor-pointer"
    >
      {/* Washi Tape Effect - Random Colors */}
      <div
        className={`absolute -top-3 left-1/2 -translate-x-1/2 w-28 h-8 opacity-90 backdrop-blur-sm rotate-[-2deg] z-20 shadow-sm mask-tape ${
          ["bg-pink-200/80", "bg-blue-200/80", "bg-yellow-200/80", "bg-green-200/80"][flag.id % 4]
        }`}
        style={{ clipPath: "polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)" }}
      />

      {/* Decorative Sticker */}
      {showSticker && (
        <div className="absolute -top-4 -right-4 z-30 pointer-events-none drop-shadow-md transform rotate-12">
          {stickerType === "star" ? (
            <div className="text-yellow-400 text-4xl">★</div>
          ) : (
            <div className="text-pink-400 text-3xl">♥</div>
          )}
        </div>
      )}

      <div className="relative h-full">
        <div className="h-full rounded-[2rem] bg-white border-[6px] border-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] transition-all duration-300 overflow-hidden flex flex-col relative">
          {/* Paper Texture Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-10 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />

          {/* Header Image/Icon Area */}
          <div
            className={`h-28 w-full bg-gradient-to-br ${s.gradient} relative overflow-hidden shrink-0`}
          >
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />

            {/* Tag */}
            <div className="absolute top-4 left-4 z-10">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/90 backdrop-blur-sm shadow-sm ${s.color} transform -rotate-2 group-hover:rotate-0 transition-transform`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                <span>{s.label}</span>
              </div>
            </div>

            {/* Giant Icon */}
            <div className="absolute bottom-[-10px] right-[-10px] opacity-25 rotate-12 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
              <StatusIcon className="w-36 h-36 text-white mix-blend-overlay" />
            </div>
          </div>

          <div className="p-6 pt-5 flex flex-col flex-grow bg-white relative">
            <div className="mb-4 flex-grow">
              <h3 className="text-xl font-black text-gray-800 tracking-tight mb-2 leading-snug group-hover:text-purple-600 transition-colors">
                {flag.title}
              </h3>
              {flag.description && (
                <p className="text-sm text-gray-500 font-bold leading-relaxed line-clamp-3 opacity-80">
                  {flag.description}
                </p>
              )}
            </div>

            <div className="mb-3">
              {flag.verification_type === "self" ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-[11px] font-bold text-purple-700">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>自我验证</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">
                  <Users className="w-3.5 h-3.5" />
                  <span>好友监督</span>
                  {flag.witness_id && (
                    <span className="text-[10px] text-gray-500">
                      {flag.witness_id.length > 12
                        ? `${flag.witness_id.slice(0, 6)}...${flag.witness_id.slice(-4)}`
                        : flag.witness_id}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl p-3 border-2 border-dashed border-gray-200 mb-4 relative group-hover:border-purple-200 transition-colors">
              <div className="flex items-center justify-between text-xs font-black mb-2">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
                  <span>{daysActive} Days</span>
                </div>
                <span className="text-gray-400 bg-white px-2 py-0.5 rounded-md shadow-sm border border-gray-100">
                  {remainText}
                </span>
              </div>

              <div className="h-3 w-full bg-white rounded-full overflow-hidden border border-gray-200 shadow-inner">
                <div
                  className="h-full rounded-full bg-[repeating-linear-gradient(45deg,theme(colors.purple.400),theme(colors.purple.400)_10px,theme(colors.purple.300)_10px,theme(colors.purple.300)_20px)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto pt-2">
              <div className="flex -space-x-2 overflow-hidden">
                {flag.proof_image_url ? (
                  <div className="w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden ring-2 ring-gray-100 relative z-10">
                    <LazyImage
                      src={flag.proof_image_url}
                      alt={flag.title || "打卡图片"}
                      className="w-full h-full object-cover rounded-full"
                      placeholderClassName="rounded-full bg-gradient-to-br from-purple-100 to-pink-100"
                      rootMargin={100}
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-gray-300 ring-2 ring-gray-50">
                    <Camera className="w-5 h-5" />
                  </div>
                )}
              </div>

              {isMine && flag.status === "active" && (
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckin?.();
                  }}
                  className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow-xl shadow-gray-900/20 hover:bg-purple-600 hover:shadow-purple-500/30 transition-all"
                >
                  <ArrowUpRight className="w-6 h-6" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
