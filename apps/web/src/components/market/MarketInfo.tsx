
import React, { useState } from "react";
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
import { PredictionDetail } from "@/app/prediction/[id]/PredictionDetailClient";
import dynamic from "next/dynamic";

const ChatPanel = dynamic(() => import("@/components/ChatPanel"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] flex items-center justify-center text-gray-500">
      加载评论...
    </div>
  ),
});

interface MarketInfoProps {
  prediction: PredictionDetail;
}

export function MarketInfo({ prediction }: MarketInfoProps) {
  const [activeTab, setActiveTab] = useState<"desc" | "rules" | "comments">(
    "desc"
  );
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);

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
          市场详情
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
          裁决规则
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
          讨论
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
                关于此市场
              </h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line text-base">
                {prediction.description}
              </p>
            </div>
            {prediction.referenceUrl && (
              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 hover:bg-purple-50 transition-colors">
                <div className="text-xs font-semibold text-purple-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3" /> 参考来源
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
                裁决标准
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
                    收起 <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    展开全部 <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                   <div className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">仲裁者</div>
                   <div className="text-base font-medium text-gray-900 flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                     Foresight Oracle Committee
                   </div>
               </div>
               <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                   <div className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">裁决时间</div>
                   <div className="text-base font-medium text-gray-900 flex items-center gap-2">
                     <Clock className="w-4 h-4 text-gray-400" />
                     {new Date(prediction.deadline).toLocaleString()} 后 24小时内
                   </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === "comments" && (
          <div className="min-h-[400px]">
            <ChatPanel
              eventId={prediction.id}
              roomTitle={prediction.title}
            />
          </div>
        )}
      </div>
    </div>
  );
}
