import CreateFlagModal from "@/components/CreateFlagModal";
import StickerRevealModal, {
  OFFICIAL_STICKERS,
  type StickerItem,
} from "@/components/StickerRevealModal";
import StickerGalleryModal from "@/components/StickerGalleryModal";
import WalletModal from "@/components/WalletModal";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";
import { FlagsHistoryModal } from "../FlagsHistoryModal";
import type { OfficialTemplate } from "../flagsConfig";
import type { FlagsData } from "../useFlagsData";
import { CheckinModal } from "./CheckinModal";
import { SettleModal } from "./SettleModal";
import { OfficialTemplatesModal } from "./OfficialTemplatesModal";
import type { FlagItem } from "@/components/FlagCard";

export type FlagsPageViewUIState = {
  createOpen: boolean;
  walletModalOpen: boolean;
  initTitle: string;
  initDesc: string;
  checkinOpen: boolean;
  checkinFlag: FlagItem | null;
  checkinNote: string;
  checkinImage: string;
  checkinSubmitting: boolean;
  historyOpen: boolean;
  historyFlag: FlagItem | null;
  historyLoading: boolean;
  historyItems: Array<{
    id: string;
    note: string;
    image_url?: string;
    created_at: string;
    review_status?: string;
    reviewer_id?: string;
    review_reason?: string;
    reviewed_at?: string;
  }>;
  reviewSubmittingId: string | null;
  settleOpen: boolean;
  settleFlag: FlagItem | null;
  settleSubmitting: boolean;
  stickerOpen: boolean;
  earnedSticker: StickerItem | null;
  galleryOpen: boolean;
  officialCreate: boolean;
  officialListOpen: boolean;
  selectedTplId: string;
  tplConfig: any;
  witnessTasksMode: boolean;
  witnessTaskIndex: number | null;
  witnessTaskTotal: number;
};

export type FlagsPageViewUIActions = {
  handleCreateClick: () => void;
  openCheckin: (flag: FlagItem) => void;
  submitCheckin: () => void;
  openHistory: (flag: FlagItem) => void;
  handleReview: (checkinId: string, action: "approve" | "reject") => void;
  settleFlag: (flag: FlagItem) => void;
  submitSettle: () => void;
  setSettleOpen: (open: boolean) => void;
  handleTemplateClick: (template: OfficialTemplate) => void;
  openWitnessTasks: () => void;
  setCreateOpen: (open: boolean) => void;
  setWalletModalOpen: (open: boolean) => void;
  setGalleryOpen: (open: boolean) => void;
  setOfficialListOpen: (open: boolean) => void;
  setCheckinOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  setStickerOpen: (open: boolean) => void;
  setCheckinNote: (value: string) => void;
  setCheckinImage: (value: string) => void;
};

export type FlagsModalsProps = {
  tFlags: (key: string) => string;
  officialTemplates: OfficialTemplate[];
  data: FlagsData;
  uiState: FlagsPageViewUIState;
  uiActions: FlagsPageViewUIActions;
};

export function FlagsModals({
  tFlags,
  officialTemplates,
  data,
  uiState,
  uiActions,
}: FlagsModalsProps) {
  const auth = useAuthOptional();
  const userId = auth?.user?.id ?? null;
  const prevUserIdRef = useRef<string | null>(userId);
  const { collectedStickers, dbStickers, loadFlags, viewerId } = data;

  const {
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
    settleOpen,
    settleFlag,
    settleSubmitting,
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
  } = uiState;

  const {
    handleTemplateClick,
    setCreateOpen,
    setWalletModalOpen,
    setGalleryOpen,
    setOfficialListOpen,
    setCheckinOpen,
    setHistoryOpen,
    setStickerOpen,
    setCheckinNote,
    setCheckinImage,
    submitCheckin,
    submitSettle,
    setSettleOpen,
    handleReview,
    openWitnessTasks,
  } = uiActions;

  const allStickerList = dbStickers.length > 0 ? dbStickers : OFFICIAL_STICKERS;

  useEffect(() => {
    const prev = prevUserIdRef.current;
    const curr = userId;
    if (walletModalOpen && !prev && curr) {
      setWalletModalOpen(false);
    }
    prevUserIdRef.current = curr;
  }, [userId, walletModalOpen, setWalletModalOpen]);

  return (
    <>
      <OfficialTemplatesModal
        isOpen={officialListOpen}
        templates={officialTemplates}
        tFlags={tFlags}
        onClose={() => setOfficialListOpen(false)}
        onTemplateClick={handleTemplateClick}
      />

      <CreateFlagModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          loadFlags();
        }}
        defaultTemplateId={selectedTplId}
        defaultConfig={tplConfig}
        defaultTitle={initTitle}
        defaultDesc={initDesc}
        isOfficial={officialCreate}
      />

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />

      <StickerRevealModal
        isOpen={stickerOpen}
        onClose={() => setStickerOpen(false)}
        sticker={earnedSticker || undefined}
        mode="auto"
      />

      <StickerGalleryModal
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        collectedIds={collectedStickers}
        stickers={allStickerList}
      />

      <CheckinModal
        isOpen={checkinOpen}
        flag={checkinFlag}
        tFlags={tFlags}
        note={checkinNote}
        image={checkinImage}
        submitting={checkinSubmitting}
        onClose={() => setCheckinOpen(false)}
        onSubmit={submitCheckin}
        onNoteChange={setCheckinNote}
        onImageChange={setCheckinImage}
      />

      <SettleModal
        isOpen={settleOpen}
        flag={settleFlag}
        tFlags={tFlags}
        submitting={settleSubmitting}
        onClose={() => setSettleOpen(false)}
        onConfirm={submitSettle}
      />

      <FlagsHistoryModal
        isOpen={historyOpen}
        flag={historyFlag}
        loading={historyLoading}
        items={historyItems}
        viewerId={viewerId}
        reviewSubmittingId={reviewSubmittingId}
        onClose={() => setHistoryOpen(false)}
        onReview={handleReview}
        tFlags={tFlags}
        tasksIndex={witnessTaskIndex ?? undefined}
        tasksTotal={witnessTaskTotal}
      />
    </>
  );
}
