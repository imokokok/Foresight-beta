import React from "react";
import type { OfficialTemplate } from "./flagsConfig";
import type { FlagsData } from "./useFlagsData";
import { FlagsBackgroundLayout } from "./components/FlagsBackgroundLayout";
import { FlagsMainContent } from "./components/FlagsMainContent";
import {
  FlagsModals,
  type FlagsPageViewUIActions,
  type FlagsPageViewUIState,
} from "./components/FlagsModals";
import { FlagsPageHeader } from "./components/FlagsPageHeader";
import { FlagsRightSidebar } from "./components/FlagsRightSidebar";

export type FlagsPageViewProps = {
  tFlags: (key: string) => string;
  officialTemplates: OfficialTemplate[];
  jsonLd: any;
  account: string | null | undefined;
  userId: string | null | undefined;
  data: FlagsData;
  uiState: FlagsPageViewUIState;
  uiActions: FlagsPageViewUIActions;
};

export function FlagsPageView({
  tFlags,
  officialTemplates,
  jsonLd,
  account,
  userId,
  data,
  uiState,
  uiActions,
}: FlagsPageViewProps) {
  const {
    flags,
    loading,
    statusFilter,
    setStatusFilter,
    collectedStickers,
    inviteNotice,
    invitesCount,
    activeFlags,
    completedFlags,
    filteredFlags,
    viewerId,
    witnessFlags,
  } = data;

  const {
    handleCreateClick,
    openCheckin,
    openHistory,
    settleFlag,
    handleTemplateClick,
    setGalleryOpen,
    setOfficialListOpen,
  } = uiActions;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FlagsBackgroundLayout>
        <div className="flex-1 flex flex-col min-w-0 z-10 h-full max-w-[1600px] mx-auto w-full">
          <FlagsPageHeader
            tFlags={tFlags}
            activeCount={activeFlags.length}
            completedCount={completedFlags.length}
            invitesCount={invitesCount}
            inviteNotice={inviteNotice}
            viewerId={viewerId}
            flags={flags}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            witnessFlags={witnessFlags}
            collectedCount={collectedStickers.length}
            onOpenGallery={() => setGalleryOpen(true)}
            onOpenHistory={openHistory}
          />

          <FlagsMainContent
            tFlags={tFlags}
            loading={loading}
            filteredFlags={filteredFlags}
            account={account}
            userId={userId}
            onCreate={handleCreateClick}
            onCheckin={openCheckin}
            onOpenHistory={openHistory}
            onSettle={settleFlag}
          />
        </div>

        <FlagsRightSidebar
          tFlags={tFlags}
          officialTemplates={officialTemplates}
          onTemplateClick={handleTemplateClick}
          onViewAll={() => setOfficialListOpen(true)}
        />

        <FlagsModals
          tFlags={tFlags}
          officialTemplates={officialTemplates}
          data={data}
          uiState={uiState}
          uiActions={uiActions}
        />
      </FlagsBackgroundLayout>
    </>
  );
}
