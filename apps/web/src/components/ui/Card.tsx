"use client";
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: () => void;
}

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
};

export default function Card({
  children,
  className = "",
  hover = true,
  padding = "md",
  onClick,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        glass-card
        rounded-2xl
        ${hover ? "glass-card-hover cursor-pointer" : ""}
        ${paddings[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
