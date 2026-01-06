import React from "react";
import { LucideIcon } from "lucide-react";

export function CenteredSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
    </div>
  );
}

export type SidebarStatCardProps = {
  value: React.ReactNode;
  label: React.ReactNode;
  icon: LucideIcon;
  color: "violet" | "emerald" | "cyan" | "amber";
};

const COLOR_MAP = {
  violet: {
    text: "text-violet-600",
    bg: "bg-violet-50/40",
    icon: "text-violet-500",
    glow: "group-hover:bg-violet-400/10",
  },
  emerald: {
    text: "text-emerald-600",
    bg: "bg-emerald-50/40",
    icon: "text-emerald-500",
    glow: "group-hover:bg-emerald-400/10",
  },
  cyan: {
    text: "text-cyan-600",
    bg: "bg-cyan-50/40",
    icon: "text-cyan-500",
    glow: "group-hover:bg-cyan-400/10",
  },
  amber: {
    text: "text-amber-600",
    bg: "bg-amber-50/40",
    icon: "text-amber-500",
    glow: "group-hover:bg-amber-400/10",
  },
};

export function SidebarStatCard({ value, label, icon: Icon, color }: SidebarStatCardProps) {
  const styles = COLOR_MAP[color];

  return (
    <div
      className={`
        group relative flex flex-col items-center justify-center
        py-5 px-1 rounded-[1.75rem] transition-all duration-500
        ${styles.bg} hover:bg-white border border-transparent hover:border-white/80
        hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)]
        active:scale-95 min-w-0
      `}
    >
      {/* 悬浮时的扩散光晕效果 */}
      <div
        className={`absolute inset-0 rounded-[1.75rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${styles.glow}`}
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* 数字显示 - 增加字重和间距 */}
        <div className={`text-2xl font-black tracking-tighter mb-0.5 ${styles.text}`}>{value}</div>

        {/* 图标与标签组合 - 更加精致 */}
        <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-all duration-300">
          <Icon className={`w-3 h-3 ${styles.icon}`} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${styles.text}`}>
            {label}
          </span>
        </div>
      </div>

      {/* 底部互动装饰线 */}
      <div
        className={`
          absolute bottom-3 w-4 h-1 rounded-full opacity-0 
          group-hover:opacity-100 group-hover:w-8 
          transition-all duration-500 ${styles.text.replace("text-", "bg-")}
        `}
      />
    </div>
  );
}

export type ProfileCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function ProfileCard({ children, className = "" }: ProfileCardProps) {
  return (
    <div className={`bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
