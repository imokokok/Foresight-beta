"use client";

import React from "react";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import EmptyState from "@/components/EmptyState";
import { useTranslations } from "@/lib/i18n";
import { CenteredSpinner } from "./ProfileUI";
import { UserHoverCard } from "@/components/ui/UserHoverCard";
import type { ProfileUserSummary } from "../types";

export function FollowersTab({ address }: { address: string }) {
  const tProfile = useTranslations("profile");
  const tCommon = useTranslations("common");
  const safeAddress = encodeURIComponent(address);

  const query = useQuery<ProfileUserSummary[]>({
    queryKey: ["profile", "followers", address],
    queryFn: async () => {
      const res = await fetch(`/api/user-follows/followers-users?address=${safeAddress}`);
      if (!res.ok) throw new Error("Failed to fetch followers");
      const data = await res.json().catch(() => ({}));
      return Array.isArray(data.users) ? (data.users as ProfileUserSummary[]) : [];
    },
    enabled: !!address,
    staleTime: 2 * 60 * 1000,
  });

  if (query.isLoading) return <CenteredSpinner />;
  if (query.isError) {
    return (
      <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
        <div className="text-sm font-bold text-gray-700">{tCommon("loadFailed")}</div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl font-bold text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          {tCommon("retry")}
        </button>
      </div>
    );
  }

  const users = query.data || [];

  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={tProfile("followers.empty.title")}
        description={tProfile("followers.empty.description")}
      />
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Users className="w-5 h-5 text-emerald-500" />
        {tProfile("sidebar.stats.followers")}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <UserHoverCard key={user.wallet_address} user={user}>
            <div className="bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group flex items-center gap-4">
              <div className="relative">
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-12 h-12 rounded-2xl object-cover bg-gray-50"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                  <Users className="w-2.5 h-2.5 text-emerald-500" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                  {user.username}
                </h4>
                <p className="text-xs text-gray-400 font-bold">
                  {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                </p>
              </div>
            </div>
          </UserHoverCard>
        ))}
      </div>
    </div>
  );
}
