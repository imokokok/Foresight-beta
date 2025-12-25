"use client";

import React from "react";
import { Heart, Loader2 } from "lucide-react";

type FollowButtonProps = {
  isFollowed: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  dataEventId?: number | string;
  className?: string;
  disabled?: boolean;
};

export function FollowButton({
  isFollowed,
  onClick,
  dataEventId,
  className,
  disabled,
}: FollowButtonProps) {
  return (
    <button
      data-event-index={dataEventId}
      onClick={onClick}
      disabled={disabled}
      aria-busy={disabled || undefined}
      className={`p-2 backdrop-blur-sm rounded-full shadow-md overflow-hidden transition-transform duration-150 hover:scale-110 active:scale-90 ${
        isFollowed ? "bg-red-500/10" : "bg-white/90"
      } ${disabled ? "opacity-60 cursor-not-allowed hover:scale-100 active:scale-100" : ""} ${
        className || ""
      }`}
    >
      <div className="transition-transform duration-200">
        {disabled ? (
          <Loader2
            className={`w-4 h-4 animate-spin ${isFollowed ? "text-red-500" : "text-gray-400"}`}
          />
        ) : (
          <Heart
            className={`w-5 h-5 ${isFollowed ? "fill-red-500 text-red-500" : "text-gray-500"}`}
          />
        )}
      </div>
    </button>
  );
}
