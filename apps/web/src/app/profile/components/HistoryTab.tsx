"use client";

import React from "react";
import Link from "next/link";
import { Clock, ChevronRight, History as HistoryIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { CenteredSpinner } from "./ProfileUI";
import type { ProfileHistoryItem } from "../types";

export function HistoryTab({
  history,
  loading,
}: {
  history: ProfileHistoryItem[];
  loading: boolean;
}) {
  const tProfile = useTranslations("profile");
  const { locale } = useLocale();

  if (loading) return <CenteredSpinner />;

  if (history.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title={tProfile("history.empty.title")}
        description={tProfile("history.empty.description")}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <HistoryIcon className="w-5 h-5 text-purple-500" />
          {tProfile("history.title")}
        </h3>
      </div>
      <div className="grid gap-4">
        {history.map((item) => (
          <Link href={`/prediction/${item.id}`} key={item.id}>
            <div className="bg-white rounded-[1.5rem] p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                <img
                  src={item.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${item.id}`}
                  alt={item.title || tProfile("history.alt.cover")}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {item.category && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      {item.category}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDateTime(item.viewed_at, locale)}
                  </span>
                </div>
                <h4 className="font-bold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors">
                  {item.title}
                </h4>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
