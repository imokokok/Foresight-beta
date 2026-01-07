import Link from "next/link";
import { ShieldCheck, Smile } from "lucide-react";
import type { FlagItem } from "@/components/FlagCard";

export type FlagsPageHeaderProps = {
  tFlags: (key: string) => string;
  activeCount: number;
  completedCount: number;
  invitesCount: number;
  inviteNotice: { id: number; title: string } | null;
  viewerId: string;
  flags: FlagItem[];
  statusFilter: "all" | "active" | "success" | "witnessRequests";
  setStatusFilter: (value: "all" | "active" | "success" | "witnessRequests") => void;
  witnessFlags: FlagItem[];
  collectedCount: number;
  onOpenGallery: () => void;
  onOpenHistory: (flag: FlagItem) => void;
  onOpenWitnessTasks: () => void;
};

type FlagsHeaderTitleSectionProps = {
  tFlags: (key: string) => string;
  activeCount: number;
  completedCount: number;
};

function FlagsHeaderTitleSection({
  tFlags,
  activeCount,
  completedCount,
}: FlagsHeaderTitleSectionProps) {
  return (
    <>
      <h1 className="text-4xl font-black text-gray-800 tracking-tight mb-2 relative inline-block">
        {tFlags("header.title")}
        <div className="absolute -top-6 -right-8 transform rotate-12">
          <div className="px-3 py-1 bg-yellow-300 text-yellow-800 text-xs font-black uppercase tracking-widest rounded-sm shadow-sm transform -rotate-3">
            {tFlags("header.badge")}
          </div>
        </div>
      </h1>
      <div className="flex items-center gap-4 text-sm font-bold text-gray-500">
        <div className="flex items-center gap-1.5 bg-white/60 px-3 py-1.5 rounded-lg border border-white shadow-sm">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span>
            {activeCount} {tFlags("header.activeLabel")}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/60 px-3 py-1.5 rounded-lg border border-white shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>
            {completedCount} {tFlags("header.achievedLabel")}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-500 font-medium max-w-xl">
        {tFlags("header.tipPrefix")}{" "}
        <Link href="/trending" className="text-purple-600 hover:text-purple-700 hover:underline">
          {tFlags("header.tipTrending")}
        </Link>
        {tFlags("header.tipTrendingAction")}{" "}
        <Link href="/proposals" className="text-purple-600 hover:text-purple-700 hover:underline">
          {tFlags("header.tipProposals")}
        </Link>
        {tFlags("header.tipProposalsAction")}{" "}
        <Link href="/leaderboard" className="text-purple-600 hover:text-purple-700 hover:underline">
          {tFlags("header.tipLeaderboard")}
        </Link>
        {tFlags("header.tipLeaderboardAction")}{" "}
        <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
          {tFlags("header.tipForum")}
        </Link>{" "}
        {tFlags("header.tipOr")}{" "}
        <Link href="/search" className="text-purple-600 hover:text-purple-700 hover:underline">
          {tFlags("header.tipSearch")}
        </Link>
        {tFlags("header.tipSuffix")}
      </p>
    </>
  );
}

type FlagsInvitesBannerProps = {
  tFlags: (key: string) => string;
  invitesCount: number;
  inviteNotice: { id: number; title: string } | null;
  viewerId: string;
  flags: FlagItem[];
  onOpenHistory: (flag: FlagItem) => void;
  onOpenWitnessTasks: () => void;
};

function FlagsInvitesBanner({
  tFlags,
  invitesCount,
  inviteNotice,
  viewerId,
  flags,
  onOpenHistory,
  onOpenWitnessTasks,
}: FlagsInvitesBannerProps) {
  if (invitesCount <= 0) return null;

  return (
    <div className="flex items-center gap-3 bg-white/80 px-4 py-2 rounded-2xl border border-amber-200 shadow-sm">
      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
        <ShieldCheck className="w-4 h-4" />
      </div>
      <div className="flex-1 text-xs font-bold text-amber-800">
        {tFlags("invites.textPrefix")}
        {invitesCount}
        {tFlags("invites.textSuffix")}
        {inviteNotice?.title ? ` · ${inviteNotice.title}` : ""}
      </div>
      <button
        onClick={() => {
          onOpenWitnessTasks();
        }}
        className="text-[11px] font-black text-amber-700 bg-amber-100 px-3 py-1 rounded-xl hover:bg-amber-200 transition-colors"
      >
        {tFlags("invites.button")}
      </button>
    </div>
  );
}

type FlagsGalleryButtonProps = {
  tFlags: (key: string) => string;
  collectedCount: number;
  onOpenGallery: () => void;
};

function FlagsGalleryButton({ tFlags, collectedCount, onOpenGallery }: FlagsGalleryButtonProps) {
  return (
    <button
      onClick={onOpenGallery}
      className="group flex items-center gap-3 px-6 py-2.5 bg-white/40 backdrop-blur-md border border-white/50 rounded-2xl shadow-soft hover:shadow-brand/20 hover:bg-white/60 transition-all duration-300 active:scale-95"
    >
      <div className="relative">
        <Smile className="w-5 h-5 text-brand group-hover:rotate-12 transition-transform duration-300" />
        <div className="absolute inset-0 bg-brand/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <span className="text-sm font-black text-slate-800 tracking-tight">
        {tFlags("gallery.button")}
      </span>
      {collectedCount > 0 && (
        <div className="flex items-center justify-center min-w-[20px] h-[20px] bg-brand/10 rounded-lg border border-brand/20">
          <span className="text-[10px] font-black text-brand">{collectedCount}</span>
        </div>
      )}
    </button>
  );
}

type FlagsFilterTabsProps = {
  tFlags: (key: string) => string;
  statusFilter: "all" | "active" | "success" | "witnessRequests";
  setStatusFilter: (value: "all" | "active" | "success" | "witnessRequests") => void;
};

function FlagsFilterTabs({ tFlags, statusFilter, setStatusFilter }: FlagsFilterTabsProps) {
  return (
    <div className="flex bg-white/40 p-1 rounded-xl border border-white/50 backdrop-blur-sm">
      {[
        { id: "all", label: tFlags("filters.all") },
        { id: "active", label: tFlags("filters.active") },
        { id: "success", label: tFlags("filters.success") },
        { id: "witnessRequests", label: tFlags("filters.witnessRequests") },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() =>
            setStatusFilter(tab.id as "all" | "active" | "success" | "witnessRequests")
          }
          className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
            statusFilter === tab.id
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

type WitnessRequestsButtonProps = {
  tFlags: (key: string) => string;
  witnessFlags: FlagItem[];
  onOpenHistory: (flag: FlagItem) => void;
};

function WitnessRequestsButton({
  tFlags,
  witnessFlags,
  onOpenHistory,
}: WitnessRequestsButtonProps) {
  if (witnessFlags.length === 0) return null;

  return (
    <button
      onClick={() => {
        if (witnessFlags.length > 0) onOpenHistory(witnessFlags[0]);
      }}
      className="px-3 py-1.5 rounded-xl bg-purple-50 text-[11px] font-black text-purple-700 border border-purple-100 hover:bg-purple-100 transition-colors"
    >
      {tFlags("filters.witnessRequests")} {witnessFlags.length}
    </button>
  );
}

type FlagsHeaderRightSectionProps = {
  tFlags: (key: string) => string;
  collectedCount: number;
  statusFilter: "all" | "active" | "success" | "witnessRequests";
  setStatusFilter: (value: "all" | "active" | "success" | "witnessRequests") => void;
  witnessFlags: FlagItem[];
  onOpenGallery: () => void;
  onOpenHistory: (flag: FlagItem) => void;
};

function FlagsHeaderRightSection({
  tFlags,
  collectedCount,
  statusFilter,
  setStatusFilter,
  witnessFlags,
  onOpenGallery,
  onOpenHistory,
}: FlagsHeaderRightSectionProps) {
  return (
    <div className="flex items-center gap-3">
      <FlagsGalleryButton
        tFlags={tFlags}
        collectedCount={collectedCount}
        onOpenGallery={onOpenGallery}
      />

      <div className="flex items-center gap-2">
        <FlagsFilterTabs
          tFlags={tFlags}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />
        <WitnessRequestsButton
          tFlags={tFlags}
          witnessFlags={witnessFlags}
          onOpenHistory={onOpenHistory}
        />
      </div>
    </div>
  );
}

export function FlagsPageHeader({
  tFlags,
  activeCount,
  completedCount,
  invitesCount,
  inviteNotice,
  viewerId,
  flags,
  statusFilter,
  setStatusFilter,
  witnessFlags,
  collectedCount,
  onOpenGallery,
  onOpenHistory,
  onOpenWitnessTasks,
}: FlagsPageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-6 px-8 pt-4">
      <div className="space-y-3">
        <FlagsHeaderTitleSection
          tFlags={tFlags}
          activeCount={activeCount}
          completedCount={completedCount}
        />
        <FlagsInvitesBanner
          tFlags={tFlags}
          invitesCount={invitesCount}
          inviteNotice={inviteNotice}
          viewerId={viewerId}
          flags={flags}
          onOpenHistory={onOpenHistory}
          onOpenWitnessTasks={onOpenWitnessTasks}
        />
      </div>

      <FlagsHeaderRightSection
        tFlags={tFlags}
        collectedCount={collectedCount}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        witnessFlags={witnessFlags}
        onOpenGallery={onOpenGallery}
        onOpenHistory={onOpenHistory}
      />
    </div>
  );
}
