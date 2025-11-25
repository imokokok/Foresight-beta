"use client";
import React from "react";
import ChatPanel from "@/components/ChatPanel";

export default function ProposalsPage() {
  const eventId = 1;
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-cyan-50 overflow-hidden text-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-xl"></div>
      </div>

      <div className="relative z-10 px-6 lg:px-10 py-6">
        <div className="px-4 py-3 rounded-3xl mb-6 bg-gradient-to-br from-pink-50/60 to-cyan-50/60 border border-pink-200/60">
          <div className="flex items-center justify-between">
            <div className="font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">事件提案频道</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <main className="space-y-6">
            <ChatPanel
              eventId={eventId}
              roomTitle={"事件提案"}
              roomCategory={"置顶提案"}
              isProposalRoom={true}
            />
          </main>
        </div>
      </div>
    </div>
  );
}