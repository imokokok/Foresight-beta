import React from "react";
import { useTranslations } from "@/lib/i18n";

type PartitionTabsProps = {
  partition: "chat" | "debate" | "forum";
  setPartition: (partition: "chat" | "debate" | "forum") => void;
  tChat: (key: string) => string;
};

export const PartitionTabs: React.FC<PartitionTabsProps> = ({ partition, setPartition, tChat }) => {
  return (
    <div className="px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]/60 backdrop-blur-md flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
        {tChat("topics.sectionTitle")}
      </span>
      {(
        [
          { value: "chat", labelKey: "topics.chat" },
          { value: "debate", labelKey: "topics.debate" },
          { value: "forum", labelKey: "topics.forum" },
        ] as const
      ).map((t) => {
        const isActive = partition === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setPartition(t.value)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-all ${
              isActive
                ? "bg-brand/10 border-brand/40 text-brand-700 dark:text-brand-300"
                : "bg-[var(--card-bg)] border-[var(--card-border)] text-slate-500 hover:border-brand/30 hover:text-brand-700 dark:hover:text-brand-300"
            }`}
          >
            {tChat(t.labelKey)}
          </button>
        );
      })}
    </div>
  );
};
