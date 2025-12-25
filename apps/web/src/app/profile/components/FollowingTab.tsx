"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useWallet } from "@/contexts/WalletContext";
import { useTranslations, formatTranslation } from "@/lib/i18n";
import { CenteredSpinner } from "./ProfileUI";

export function FollowingTab() {
  const { account } = useWallet();
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const tEvents = useTranslations();
  const tProfile = useTranslations("profile");

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }

    const fetchFollowing = async () => {
      try {
        const res = await fetch(`/api/following?address=${account}`);
        if (!res.ok) throw new Error("Failed to fetch following");
        const data = await res.json();
        setFollowing(data.following || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [account]);

  if (loading) return <CenteredSpinner />;

  if (following.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title={tProfile("following.empty.title")}
        description={tProfile("following.empty.description")}
      />
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Heart className="w-5 h-5 text-purple-500" />
        {tProfile("following.title")}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {following.map((item) => (
          <Link href={`/prediction/${item.id}`} key={item.id}>
            <div className="bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group h-full flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <img
                  src={item.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${item.id}`}
                  alt={item.title || tProfile("following.alt.cover")}
                  className="w-10 h-10 rounded-full bg-gray-100 object-cover"
                />
                <button className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                  <Heart className="w-4 h-4 fill-current" />
                </button>
              </div>
              <h4 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                {tEvents(item.title)}
              </h4>
              <div className="mt-auto text-xs text-gray-500 flex items-center gap-2">
                <span className="bg-gray-100 px-2 py-1 rounded-md">
                  {formatTranslation(tProfile("following.labels.followers"), {
                    count: item.followers_count,
                  })}
                </span>
                {item.deadline && (
                  <span>
                    {formatTranslation(tProfile("following.labels.deadline"), {
                      date: new Date(item.deadline).toLocaleDateString(),
                    })}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
