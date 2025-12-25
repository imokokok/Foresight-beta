import React from "react";

export type FlagsBackgroundLayoutProps = {
  children: React.ReactNode;
};

export function FlagsBackgroundLayout({ children }: FlagsBackgroundLayoutProps) {
  return (
    <div className="h-[calc(100vh-64px)] w-full bg-[#FAFAFA] relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8 flex gap-6">
      <div className="fixed top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-200/40 rounded-full blur-[120px] mix-blend-multiply filter pointer-events-none animate-blob" />
      <div className="fixed top-[20%] right-[-10%] w-[600px] h-[600px] bg-pink-200/40 rounded-full blur-[120px] mix-blend-multiply filter pointer-events-none animate-blob animation-delay-2000" />
      <div className="fixed bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-orange-200/40 rounded-full blur-[120px] mix-blend-multiply filter pointer-events-none animate-blob animation-delay-4000" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 pointer-events-none mix-blend-soft-light" />
      {children}
    </div>
  );
}
