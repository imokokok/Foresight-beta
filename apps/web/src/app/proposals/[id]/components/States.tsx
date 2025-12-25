"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export function InvalidProposalFallback({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">Invalid Proposal ID</h2>
        <button onClick={onBack} className="mt-4 text-purple-600 hover:underline">
          Back to Proposals
        </button>
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      <p className="text-slate-400 font-medium">Loading proposal...</p>
    </div>
  );
}

export function ErrorState({ error }: { error: string }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
      <h3 className="text-lg font-bold text-red-800 mb-2">Error Loading Proposal</h3>
      <p className="text-red-600 mb-4">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
