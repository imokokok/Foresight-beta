"use client";

import React from "react";

export function ProposalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8faff] font-sans pb-20 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[100px]" />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">{children}</div>
    </div>
  );
}
