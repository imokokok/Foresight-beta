import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Info,
  MessageSquare,
  Scale,
} from "lucide-react";
import type { PredictionDetail } from "@/app/prediction/[id]/usePredictionDetail";
import { useTranslations } from "@/lib/i18n";

interface MarketInfoProps {
  prediction: PredictionDetail;
}

type PreviewState = {
  loading: boolean;
  error: string | null;
  lastMessage: string | null;
  lastTime: string | null;
  totalCount: number;
};

export function MarketInfo({ prediction }: MarketInfoProps) {
  const tMarket = useTranslations("market");
  const tCommon = useTranslations("common");
  const tEvents = useTranslations();
  const [activeTab, setActiveTab] = useState<"desc" | "rules" | "comments">("desc");
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({
    loading: false,
    error: null,
    lastMessage: null,
    lastTime: null,
    totalCount: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const eventId = prediction.id;
    const loadPreview = async () => {
      try {
        setPreview((prev) => ({ ...prev, loading: true, error: null }));
        const res = await fetch(`/api/forum?eventId=${eventId}`);
        const data = await res.json();
        if (cancelled) return;
        const threads = Array.isArray(data?.threads) ? data.threads : [];
        let total = 0;
        let lastMessage: string | null = null;
        let lastTime: string | null = null;
        threads.forEach((t: any) => {
          total += 1;
          const comments = Array.isArray(t.comments) ? t.comments : [];
          total += comments.length;
          const all = [t, ...comments].filter((x) => x && x.created_at);
          all.forEach((x: any) => {
            const ts = new Date(x.created_at).getTime();
            if (!Number.isFinite(ts)) return;
            if (!lastTime || ts > new Date(lastTime).getTime()) {
              lastTime = new Date(ts).toISOString();
              const content = String(x.content || x.title || "").trim();
              const title = String(t.title || "").trim();
              lastMessage = title ? `${title}\n${content}`.trim() : content || null;
            }
          });
        });
        setPreview({
          loading: false,
          error: null,
          lastMessage,
          lastTime,
          totalCount: total,
        });
      } catch (e) {
        if (cancelled) return;
        setPreview((prev) => ({
          ...prev,
          loading: false,
          error: "加载讨论预览失败，请稍后重试",
        }));
      }
    };
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [prediction.id]);

  return (
    <div className="bg-white border border-purple-100 rounded-3xl overflow-hidden shadow-sm relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none"></div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-gray-50/30 p-2 gap-2">
        <button
          onClick={() => setActiveTab("desc")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${
            activeTab === "desc"
              ? "bg-purple-100/80 text-purple-700 shadow-sm ring-1 ring-purple-200"
              : "text-gray-500 hover:text-purple-600 hover:bg-purple-50"
          }`}
        >
          <AlignLeft className="w-4 h-4" />
          {tMarket("tabs.desc")}
        </button>
        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${
            activeTab === "rules"
              ? "bg-purple-100/80 text-purple-700 shadow-sm ring-1 ring-purple-200"
              : "text-gray-500 hover:text-purple-600 hover:bg-purple-50"
          }`}
        >
          <Scale className="w-4 h-4" />
          {tMarket("tabs.rules")}
        </button>
        <button
          onClick={() => setActiveTab("comments")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${
            activeTab === "comments"
              ? "bg-purple-100/80 text-purple-700 shadow-sm ring-1 ring-purple-200"
              : "text-gray-500 hover:text-purple-600 hover:bg-purple-50"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {tMarket("tabs.comments")}
        </button>
      </div>

      {/* Content */}
      <div className="p-8">
        {activeTab === "desc" && (
          <div className="space-y-8">
            <div className="prose prose-gray max-w-none">
              <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
                  <Info className="w-5 h-5" />
                </span>
                {tMarket("about.title")}
              </h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line text-base">
                {prediction.description}
              </p>
            </div>
            {prediction.referenceUrl && (
              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 hover:bg-purple-50 transition-colors">
                <div className="text-xs font-semibold text-purple-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {tMarket("about.referenceSource")}
                </div>
                <a
                  href={prediction.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-700 hover:text-purple-900 hover:underline break-all text-sm flex items-center gap-2 font-medium"
                >
                  {prediction.referenceUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === "rules" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                  <Scale className="w-5 h-5" />
                </div>
                {tMarket("rules.criteriaTitle")}
              </h3>
              <div
                className={`text-gray-600 text-sm leading-relaxed transition-all duration-300 overflow-hidden ${
                  isRulesExpanded ? "" : "max-h-[120px] relative"
                }`}
              >
                <div className="whitespace-pre-line">{prediction.criteria}</div>
                {!isRulesExpanded && (
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />
                )}
              </div>
              <button
                onClick={() => setIsRulesExpanded(!isRulesExpanded)}
                className="mt-3 text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1.5 font-semibold bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                {isRulesExpanded ? (
                  <>
                    {tCommon("less")} <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    {tCommon("more")} <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                  {tMarket("rules.arbitrator")}
                </div>
                <div className="text-base font-medium text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  {tMarket("rules.arbitratorName")}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                  {tMarket("rules.resolutionTime")}
                </div>
                <div className="text-base font-medium text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {tMarket("rules.resolutionTimeValue").replace(
                    "{deadline}",
                    new Date(prediction.deadline).toLocaleString()
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "comments" && (
          <div className="min-h-[240px] flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              讨论已迁移到预测论坛的专属聊天室
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              为了把同一事件下的观点、策略和复盘集中在一个地方，本页面不再提供内嵌讨论。 你可以前往
              Foresight 讨论区中该事件的聊天室继续交流。
            </p>

            <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/50 px-4 py-3 text-sm text-gray-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">聊天室预览</span>
                {preview.loading && <span className="text-xs text-gray-400">加载中…</span>}
                {!preview.loading && preview.totalCount > 0 && (
                  <span className="text-xs text-gray-500">
                    共 {preview.totalCount} 条帖子与回复
                  </span>
                )}
              </div>
              {preview.error && <div className="text-xs text-red-500">{preview.error}</div>}
              {!preview.error && !preview.loading && preview.lastMessage && (
                <div className="text-xs text-gray-700 whitespace-pre-line line-clamp-3">
                  {preview.lastMessage}
                </div>
              )}
              {!preview.error && !preview.loading && !preview.lastMessage && (
                <div className="text-xs text-gray-500">
                  还没有任何讨论，快去论坛里发起第一条话题吧。
                </div>
              )}
            </div>

            <div className="text-xs text-gray-500 leading-relaxed space-y-1">
              <p>
                Foresight
                讨论区是预测市场参与者交流观点、分享策略的核心社区，你可以创建主题讨论现实世界事件，或参与现有预测的深度分析。
              </p>
              <p>
                前往{" "}
                <Link
                  href="/trending"
                  className="text-purple-600 hover:text-purple-700 hover:underline"
                >
                  热门预测
                </Link>{" "}
                发现可讨论的事件，或在{" "}
                <Link
                  href="/proposals"
                  className="text-purple-600 hover:text-purple-700 hover:underline"
                >
                  提案广场
                </Link>{" "}
                发起新预测。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/forum?eventId=${prediction.id}`}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-sm hover:bg-purple-700 transition-colors"
              >
                前往对应聊天室
              </Link>
              <span className="text-xs text-gray-500">
                在讨论区中可以查看完整消息历史、话题列表和相关预测市场。
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
