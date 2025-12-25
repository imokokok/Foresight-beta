"use client";

import React from "react";

export function CenteredSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
    </div>
  );
}

export type SidebarStatCardProps = {
  value: React.ReactNode;
  label: React.ReactNode;
  containerClass: string;
  valueClass: string;
  labelClass: string;
};

export function SidebarStatCard({
  value,
  label,
  containerClass,
  valueClass,
  labelClass,
}: SidebarStatCardProps) {
  return (
    <div className={`text-center p-3 rounded-2xl transition-colors ${containerClass}`}>
      <div className={`text-xl font-black ${valueClass}`}>{value}</div>
      <div className={`text-[10px] font-bold uppercase tracking-wide ${labelClass}`}>{label}</div>
    </div>
  );
}

export type ProfileCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function ProfileCard({ children, className = "" }: ProfileCardProps) {
  return (
    <div className={`bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
