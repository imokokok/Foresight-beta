"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MessageCircle, ArrowLeft, ArrowUpRight } from "lucide-react";
import { ProposalChatShell } from "@/app/proposals/[id]/components/chat/ProposalChatShell";
import ChatPanel from "@/components/ChatPanel";
import { useWallet } from "@/contexts/WalletContext";
import { useUser } from "@/contexts/UserContext";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type ForumChatDetailClientProps = {
  eventId: number;
  prediction: Pick<
    Database["public"]["Tables"]["predictions"]["Row"],
    "id" | "title" | "category" | "description" | "followers_count" | "created_at"
  > | null;
};

export default function ForumChatDetailClient({ eventId, prediction }: ForumChatDetailClientProps) {
  const router = useRouter();
  const { address } = useWallet();
  const { user } = useUser();
  const tForum = useTranslations("forum");
  const tChat = useTranslations("chat");
  const { locale } = useLocale();

  const roomTitle = prediction?.title || tForum("chatRoom");
  const category = prediction?.category || "";
  const followers = prediction?.followers_count ?? 0;

  const displayName = useMemo(() => {
    const base = address || user?.email || tForum("guestFallback");
    return base.slice(0, 12);
  }, [address, user, tForum]);

  const createdAtLabel = useMemo(() => {
    if (!prediction?.created_at) return "";
    return formatDateTime(prediction.created_at, locale);
  }, [prediction?.created_at, locale]);

  return (
    <ProposalChatShell>
      <div className="w-full flex-1 min-h-0 flex flex-col px-4 sm:px-6 lg:px-10 py-4">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/forum")}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {tForum("backToForum")}
              </button>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
                <span className="px-2 py-1 rounded-full bg-white/70 border border-slate-200">
                  #{eventId}
                </span>
                <span className="px-2 py-1 rounded-full bg-white/70 border border-slate-200">
                  {followers} {tForum("followersLabelShort")}
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
              <span className="px-2 py-1 rounded-full bg-white/70 border border-slate-200">
                {tChat("header.youLabel").replace("{name}", displayName)}
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-lg shadow-slate-200/40 flex flex-col h-full overflow-hidden">
              <section className="flex-1 flex flex-col">
                <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center border border-purple-100 shrink-0">
                      <MessageCircle className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 text-white font-semibold">
                          {tForum("liveDiscussion")}
                        </span>
                        {category && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-medium whitespace-nowrap text-slate-600">
                            {category}
                          </span>
                        )}
                      </div>
                      <h1 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug line-clamp-2">
                        {roomTitle}
                      </h1>
                      {createdAtLabel && (
                        <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                          <span>{createdAtLabel}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => router.push(`/prediction/${eventId}`)}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all inline-flex items-center justify-center gap-2"
                    >
                      {tForum("viewMarket")}
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-[280px]">
                  <ChatPanel
                    eventId={eventId}
                    roomTitle={roomTitle}
                    roomCategory={category}
                    hideHeader={true}
                    className="shadow-none border-none rounded-t-none rounded-b-3xl"
                  />
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      </div>
    </ProposalChatShell>
  );
}
