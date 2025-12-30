"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { FlagItem } from "@/components/FlagCard";
import { OFFICIAL_STICKERS, type StickerItem } from "@/components/StickerRevealModal";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n";
import { useFlagsData } from "./useFlagsData";
import { buildOfficialTemplates, defaultConfigFor, OfficialTemplate } from "./flagsConfig";
import { FlagsPageView } from "./FlagsPageView";

function buildFlagsJsonLd(tFlags: (key: string) => string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: tFlags("page.jsonLdName"),
        url: baseUrl + "/flags",
        description: tFlags("page.jsonLdDescription"),
        inLanguage: "zh-CN",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: tFlags("page.breadcrumbHome"),
            item: baseUrl + "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: tFlags("page.breadcrumbFlags"),
            item: baseUrl + "/flags",
          },
        ],
      },
    ],
  };
}

export default function FlagsPage() {
  const { account } = useWallet();
  const { user } = useAuth();
  const tFlags = useTranslations("flags");
  const officialTemplates = buildOfficialTemplates(tFlags);
  const [createOpen, setCreateOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [initTitle, setInitTitle] = useState("");
  const [initDesc, setInitDesc] = useState("");
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinFlag, setCheckinFlag] = useState<FlagItem | null>(null);
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinImage, setCheckinImage] = useState("");
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFlag, setHistoryFlag] = useState<FlagItem | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<
    Array<{
      id: string;
      note: string;
      image_url?: string;
      created_at: string;
      review_status?: string;
      reviewer_id?: string;
      review_reason?: string;
    }>
  >([]);
  const [reviewSubmittingId, setReviewSubmittingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [earnedSticker, setEarnedSticker] = useState<StickerItem | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [officialCreate, setOfficialCreate] = useState(false);
  const [officialListOpen, setOfficialListOpen] = useState(false);
  const [selectedTplId, setSelectedTplId] = useState("");
  const [tplConfig, setTplConfig] = useState<any>({});
  const [witnessTasksMode, setWitnessTasksMode] = useState(false);
  const [witnessTaskIndex, setWitnessTaskIndex] = useState<number | null>(null);
  const [witnessTaskTotal, setWitnessTaskTotal] = useState(0);
  const [witnessTasksQueue, setWitnessTasksQueue] = useState<FlagItem[]>([]);

  const data = useFlagsData(account, user?.id || null, tFlags);
  const {
    flags,
    loading,
    filterMine,
    setFilterMine,
    statusFilter,
    setStatusFilter,
    collectedStickers,
    dbStickers,
    inviteNotice,
    invitesCount,
    loadFlags,
    activeFlags,
    completedFlags,
    filteredFlags,
    viewerId,
    witnessFlags,
    pendingReviewFlagsForViewer,
  } = data;

  const handleCreateClick = () => {
    if (!account && !user) {
      setWalletModalOpen(true);
      return;
    }
    setInitTitle("");
    setInitDesc("");
    setOfficialCreate(false);
    setSelectedTplId("");
    setTplConfig({});
    setCreateOpen(true);
  };

  const openCheckin = (flag: FlagItem) => {
    const deadline = new Date(flag.deadline);
    const now = new Date();
    if (!Number.isNaN(deadline.getTime()) && now > deadline) {
      toast.info(tFlags("toast.checkinExpiredTitle"), tFlags("toast.checkinExpiredDesc"));
      return;
    }
    setCheckinFlag(flag);
    setCheckinNote("");
    setCheckinImage("");
    setCheckinOpen(true);
  };

  const submitCheckin = async () => {
    if (!checkinFlag) return;
    try {
      setCheckinSubmitting(true);
      const res = await fetch(`/api/flags/${checkinFlag.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: checkinNote,
          image_url: checkinImage,
        }),
      });
      if (!res.ok) throw new Error("Checkin failed");
      const ret = await res.json();
      setCheckinOpen(false);
      toast.success(
        tFlags("toast.checkinSuccessTitle"),
        ret.sticker_earned
          ? tFlags("toast.checkinSuccessDesc")
          : tFlags("toast.checkinSuccessNoStickerDesc")
      );
      loadFlags();
      if (ret.sticker_earned) {
        if (ret.sticker) {
          setEarnedSticker(ret.sticker);
          setTimeout(() => setStickerOpen(true), 100);
        } else if (ret.sticker_id) {
          const s = OFFICIAL_STICKERS.find((x) => x.id === ret.sticker_id);
          if (s) {
            setEarnedSticker(s);
            setTimeout(() => setStickerOpen(true), 100);
          }
        }
      }
    } catch (e) {
      toast.error(tFlags("toast.checkinFailedTitle"), tFlags("toast.checkinFailedDesc"));
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const openHistory = async (flag: FlagItem) => {
    setHistoryFlag(flag);
    setHistoryItems([]);
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const res = await fetch(`/api/flags/${flag.id}/checkins?limit=50`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}) as any);
      const items = Array.isArray(data?.items) ? data.items : [];
      setHistoryItems(items);
    } catch {
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReview = async (checkinId: string, action: "approve" | "reject") => {
    try {
      setReviewSubmittingId(checkinId);
      const reasonKey =
        action === "reject" ? "history.reviewReason.rejected" : "history.reviewReason.approved";
      const reason = tFlags(reasonKey);
      const res = await fetch(`/api/checkins/${checkinId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason,
        }),
      });
      if (!res.ok) throw new Error("Review failed");
      if (witnessTasksMode && witnessTasksQueue.length > 0 && witnessTaskIndex !== null) {
        const nextIndex = witnessTaskIndex + 1;
        if (nextIndex < witnessTasksQueue.length) {
          const nextFlag = witnessTasksQueue[nextIndex];
          setWitnessTaskIndex(nextIndex);
          openHistory(nextFlag);
        } else {
          setWitnessTasksMode(false);
          setWitnessTaskIndex(null);
          setWitnessTaskTotal(0);
          setHistoryOpen(false);
        }
      } else if (historyFlag) {
        openHistory(historyFlag);
      }
      loadFlags();
    } catch (e) {
      toast.error(tFlags("toast.reviewFailedTitle"), tFlags("toast.reviewFailedDesc"));
    } finally {
      setReviewSubmittingId(null);
    }
  };

  const settleFlag = async (flag: FlagItem) => {
    if (!confirm(tFlags("toast.settleConfirmMessage"))) return;
    try {
      setSettlingId(flag.id);
      const res = await fetch(`/api/flags/${flag.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Settle failed");
      const ret = await res.json();
      loadFlags();

      if (ret.sticker_earned) {
        if (ret.sticker) {
          setEarnedSticker(ret.sticker);
          setStickerOpen(true);
        } else {
          const s = OFFICIAL_STICKERS.find((x) => x.id === ret.sticker_id);
          if (s) {
            setEarnedSticker(s);
            setStickerOpen(true);
          }
        }
      } else {
        const statusText = String(ret?.status || "");
        const approvedDays = ret?.metrics?.approvedDays || 0;
        const totalDays = ret?.metrics?.totalDays || 0;
        const desc = `${tFlags("toast.statusLabel")}: ${statusText}, ${tFlags(
          "toast.approvedDaysLabel"
        )} ${approvedDays}/${totalDays}, ${tFlags("toast.noStickerSuffix")}`;
        toast.success(tFlags("toast.settleSuccessTitle"), desc);
      }
    } catch (e) {
      toast.error(
        tFlags("toast.settleFailedTitle"),
        String((e as any)?.message || tFlags("toast.retryLater"))
      );
    } finally {
      setSettlingId(null);
    }
  };

  const handleTemplateClick = (template: OfficialTemplate) => {
    setInitTitle(template.title);
    setInitDesc(template.description);
    setOfficialCreate(true);
    setSelectedTplId(template.id);
    setTplConfig(defaultConfigFor(template.id));
    setCreateOpen(true);
  };

  const openWitnessTasks = () => {
    const me = (account || user?.id || "").toLowerCase();
    if (!me) return;
    const tasks = pendingReviewFlagsForViewer;
    if (!tasks || tasks.length === 0) return;
    setWitnessTasksQueue(tasks);
    setWitnessTaskTotal(tasks.length);
    setWitnessTaskIndex(0);
    setWitnessTasksMode(true);
    openHistory(tasks[0]);
  };

  const jsonLd = buildFlagsJsonLd(tFlags);

  return (
    <FlagsPageView
      tFlags={tFlags}
      officialTemplates={officialTemplates}
      jsonLd={jsonLd}
      account={account}
      userId={user?.id || null}
      data={data}
      uiState={{
        createOpen,
        walletModalOpen,
        initTitle,
        initDesc,
        checkinOpen,
        checkinFlag,
        checkinNote,
        checkinImage,
        checkinSubmitting,
        historyOpen,
        historyFlag,
        historyLoading,
        historyItems,
        reviewSubmittingId,
        settlingId,
        stickerOpen,
        earnedSticker,
        galleryOpen,
        officialCreate,
        officialListOpen,
        selectedTplId,
        tplConfig,
        witnessTasksMode,
        witnessTaskIndex,
        witnessTaskTotal,
      }}
      uiActions={{
        handleCreateClick,
        openCheckin,
        submitCheckin,
        openHistory,
        handleReview,
        settleFlag,
        handleTemplateClick,
        openWitnessTasks,
        setCreateOpen,
        setWalletModalOpen,
        setGalleryOpen,
        setOfficialListOpen,
        setCheckinOpen,
        setHistoryOpen,
        setStickerOpen,
        setCheckinNote,
        setCheckinImage,
      }}
    />
  );
}
