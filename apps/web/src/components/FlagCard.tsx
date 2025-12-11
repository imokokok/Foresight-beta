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
} from "lucide-react";

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
};

interface FlagCardProps {
  flag: FlagItem;
  isMine?: boolean;
  onCheckin?: () => void;
  onViewHistory?: () => void;
  onSettle?: () => void;
}

export function FlagCard({
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

    const progress = Math.min(
      100,
      Math.max(0, (elapsed / totalDuration) * 100)
    );

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`group relative flex flex-col h-full ${s.cardBg} border ${s.border} rounded-[2rem] shadow-sm hover:shadow-2xl ${s.shadow} transition-all duration-500 overflow-hidden`}
    >
      {/* 动态背景光效 */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-30 group-hover:opacity-100 transition-opacity duration-700`}
      />

      <div className="p-6 flex flex-col h-full z-10 relative">
        {/* Header: Tag & Time */}
        <div className="flex justify-between items-start mb-5">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${s.bg} ${s.color} ${s.border} border backdrop-blur-md`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{s.label}</span>
          </div>

          <div className="flex items-center gap-2">
            {flag.verification_type === "witness" && (
              <div
                className="w-8 h-8 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600"
                title="好友监督"
              >
                <Users className="w-4 h-4" />
              </div>
            )}
            <div className="px-3 py-1.5 rounded-full bg-gray-100/80 text-gray-500 text-xs font-bold font-mono border border-gray-200/50">
              {remainText}
            </div>
          </div>
        </div>

        {/* Content: Title & Desc */}
        <div className="mb-6 flex-grow">
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-xl font-black text-gray-900 line-clamp-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 transition-all duration-300">
              {flag.title}
            </h3>
          </div>
          {flag.description && (
            <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 font-medium">
              {flag.description}
            </p>
          )}
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 mb-6 px-4 py-3 bg-white/50 rounded-2xl border border-white/60 shadow-inner">
          <div className="flex items-center gap-2 text-orange-500">
            <Flame className="w-4 h-4 fill-orange-500/20" />
            <span className="text-xs font-bold text-gray-600">
              Day {daysActive}
            </span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-2 text-blue-500">
            <CalendarDays className="w-4 h-4" />
            <span className="text-xs font-bold text-gray-600">
              {new Date(flag.deadline).toLocaleDateString(undefined, {
                month: "numeric",
                day: "numeric",
              })}{" "}
              截止
            </span>
          </div>
        </div>

        {/* Footer: Action & Proof */}
        <div className="pt-2 flex items-center justify-between mt-auto">
          {/* Proof Preview */}
          <div className="flex items-center gap-2">
            {flag.proof_image_url ? (
              <div className="relative group/proof cursor-pointer">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md ring-1 ring-gray-100 transition-transform group-hover/proof:scale-110">
                  <img
                    src={flag.proof_image_url}
                    alt="Latest proof"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Status
              </span>
              <span className="text-xs text-gray-700 font-bold">
                {flag.proof_comment ? "最近有更新" : "等待打卡"}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {isMine && flag.status === "active" && (
              <motion.button
                whileHover={{ scale: 1.1, rotate: -5 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onCheckin?.();
                }}
                className="relative w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-lg shadow-gray-900/20 hover:bg-gradient-to-r hover:from-purple-600 hover:to-pink-600 transition-all group/btn overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 rounded-full" />
                <ArrowUpRight className="w-6 h-6 relative z-10" />
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                onViewHistory?.();
              }}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center hover:border-purple-200 hover:text-purple-600 hover:shadow-md transition-all"
            >
              <MoreHorizontal className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
