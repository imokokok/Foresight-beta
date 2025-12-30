"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MessageCircle, ArrowLeft, ArrowUpRight } from "lucide-react";
import { ProposalChatShell } from "@/app/proposals/[id]/components/chat/ProposalChatShell";
import ChatPanel from "@/components/ChatPanel";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, formatTranslation, t } from "@/lib/i18n";

type ForumChatDetailClientProps = {
  id: number;
  prediction: {
    id: number;
    title?: string | null;
    category?: string | null;
    description?: string | null;
    followers_count?: number | null;
    created_at?: string | null;
  } | null;
};

export default function ForumChatDetailClient({ id, prediction }: ForumChatDetailClientProps) {
  const router = useRouter();
  const { account } = useWallet();
  const { user } = useAuth();
  const tForum = useTranslations("forum");

  const roomTitle = prediction?.title || tForum("chatRoom");
  const category = prediction?.category || "";
  const followers = prediction?.followers_count ?? 0;

  const displayName = useMemo(() => {
    const base = account || user?.email || tForum("guestFallback");
    return base.slice(0, 12);
  }, [account, user, tForum]);

  return (
    <ProposalChatShell>
      <div className="w-full flex flex-col lg:flex-row gap-4 lg:gap-0 px-4 sm:px-6 lg:px-10 py-4">
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
                  #{id}
                </span>
                <span className="px-2 py-1 rounded-full bg-white/70 border border-slate-200">
                  {followers} {tForum("followersLabelShort")}
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
              <span className="px-2 py-1 rounded-full bg-white/70 border border-slate-200">
                {t("chat.header.youLabel").replace("{name}", displayName)}
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-lg shadow-slate-200/40 flex flex-col lg:flex-row h-full overflow-hidden">
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
                      {prediction?.created_at && (
                        <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                          <span>{new Date(prediction.created_at).toLocaleString()}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-2 sm:px-4 py-3 flex-1 flex flex-col min-h-[280px]">
                  <div className="flex-1 rounded-2xl border border-slate-100 bg-slate-50/60 overflow-hidden">
                    <ChatPanel
                      eventId={id}
                      roomTitle={roomTitle}
                      roomCategory={category}
                      hideHeader={true}
                    />
                  </div>
                </div>
              </section>

              <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 p-4 sm:p-6 flex flex-col gap-4 max-h-[520px] lg:self-start bg-white/90">
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight mb-2">
                    {roomTitle}
                  </h2>
                  <p className="text-xs text-slate-500 line-clamp-3">
                    {prediction?.description || tForum("chatSidebarDescription")}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                      <div className="text-lg font-black text-slate-900">{followers}</div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase">
                        {tForum("followersLabelShort")}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                      <div className="text-lg font-black text-slate-900">#{id}</div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase">
                        {tForum("roomIdLabel")}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/prediction/${id}`)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all inline-flex items-center justify-center gap-2"
                  >
                    {tForum("viewMarket")}
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-auto text-[10px] text-slate-400 text-center pt-1">
                  {formatTranslation(tForum("roomIdFooter"), { id })}
                </div>
              </aside>
            </div>
          </motion.div>
        </div>
      </div>
    </ProposalChatShell>
  );
}
