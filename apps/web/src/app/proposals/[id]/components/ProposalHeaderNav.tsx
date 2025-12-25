"use client";

import React from "react";
import { ArrowLeft, Share2 } from "lucide-react";

export function ProposalHeaderNav({
  onBack,
  onCopyLink,
}: {
  onBack: () => void;
  onCopyLink: () => void;
}) {
  return (
    <nav className="flex items-center justify-between mb-8">
      <button
        onClick={onBack}
        className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 hover:bg-white border border-slate-200/60 shadow-sm transition-all text-sm font-bold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={onCopyLink}
          className="p-2 rounded-full bg-white/60 hover:bg-white border border-slate-200/60 shadow-sm text-slate-500 hover:text-slate-900 transition-all"
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
