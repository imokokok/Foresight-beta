"use client";
import React from "react";
import type { LeaderboardUser } from "../data";
import { TopThreeCard } from "./LeaderboardCards";

export function LeaderboardPodium({ users }: { users: LeaderboardUser[] }) {
  if (users.length < 3) return null;
  return (
    <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-20 px-4">
      <TopThreeCard user={users[1]} />
      <TopThreeCard user={users[0]} />
      <TopThreeCard user={users[2]} />
    </div>
  );
}
