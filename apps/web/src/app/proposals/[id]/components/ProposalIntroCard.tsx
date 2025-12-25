"use client";

import React from "react";
import Link from "next/link";

export function ProposalIntroCard() {
  return (
    <div className="mb-6 bg-white/70 backdrop-blur-xl rounded-3xl p-5 border border-white/60 shadow-sm">
      <p className="text-sm text-slate-700 leading-relaxed mb-2">
        提案详情页用于集中展示某个预测市场或治理议题的完整说明、上下文和社区讨论，方便参与者在链上投票或发起后续预测市场前充分了解背景。
      </p>
      <p className="text-xs text-slate-500 leading-relaxed">
        想浏览其他提案？返回{" "}
        <Link href="/proposals" className="text-purple-600 hover:text-purple-700 hover:underline">
          提案广场
        </Link>{" "}
        查看全部议题；如果你更关注最终会变成实际交易市场的事件，可以前往{" "}
        <Link href="/trending" className="text-purple-600 hover:text-purple-700 hover:underline">
          热门预测
        </Link>{" "}
        页面，或在{" "}
        <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
          讨论区
        </Link>{" "}
        继续延伸讨论。
      </p>
    </div>
  );
}
