"use client";

import React from "react";

type GradientPageProps = {
  children: React.ReactNode;
  className?: string;
};

export default function GradientPage({ children, className = "" }: GradientPageProps) {
  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-violet-100 via-fuchsia-50 to-rose-100 ${className}`}
    >
      {children}
    </div>
  );
}
