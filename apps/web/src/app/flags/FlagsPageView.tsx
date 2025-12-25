import React from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Sparkles,
  Smile,
  X,
  Trophy,
  ArrowRight,
  Camera,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FlagCard, type FlagItem } from "@/components/FlagCard";
import CreateFlagModal from "@/components/CreateFlagModal";
import StickerRevealModal, {
  OFFICIAL_STICKERS,
  type StickerItem,
} from "@/components/StickerRevealModal";
import StickerGalleryModal from "@/components/StickerGalleryModal";
import WalletModal from "@/components/WalletModal";
import { FlagsHistoryModal } from "./FlagsHistoryModal";
import type { OfficialTemplate } from "./flagsConfig";
import type { FlagsData } from "./useFlagsData";

type FlagsRightSidebarProps = {
  tFlags: (key: string) => string;
  officialTemplates: OfficialTemplate[];
  onTemplateClick: (template: OfficialTemplate) => void;
  onViewAll: () => void;
};

function FlagsRightSidebar({
  tFlags,
  officialTemplates,
  onTemplateClick,
  onViewAll,
}: FlagsRightSidebarProps) {
  return (
    <div className="hidden 2xl:flex flex-col w-72 shrink-0 gap-6 z-10 h-full overflow-y-auto scrollbar-hide pb-20">
      <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-5 border border-white/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-gray-900">{tFlags("sidebar.trendingTitle")}</h3>
          <button
            onClick={onViewAll}
            className="text-[10px] font-bold text-purple-600 hover:underline"
          >
            {tFlags("sidebar.viewAll")}
          </button>
        </div>
        <div className="space-y-3">
          {officialTemplates.slice(0, 3).map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onTemplateClick(tpl)}
              className="group w-full text-left p-3 rounded-2xl bg-white border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer flex gap-3 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tpl.gradient} flex items-center justify-center text-white shadow-sm shrink-0`}
              >
                <tpl.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 truncate group-hover:text-purple-700 transition-colors">
                  {tpl.title}
                </div>
                <div className="text-[10px] text-gray-400 font-medium truncate">
                  {tpl.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
        <div className="relative z-10">
          <Sparkles className="w-5 h-5 text-yellow-300 mb-3" />
          <p className="text-sm font-bold leading-relaxed opacity-90 mb-4">
            {tFlags("sidebar.quote.text")}
          </p>
          <div className="flex items-center gap-2 text-[10px] font-medium opacity-60">
            <div className="w-1 h-1 rounded-full bg-white" />
            <span>{tFlags("sidebar.quote.label")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type OfficialTemplatesModalProps = {
  isOpen: boolean;
  templates: OfficialTemplate[];
  tFlags: (key: string) => string;
  onClose: () => void;
  onTemplateClick: (template: OfficialTemplate) => void;
};

type OfficialTemplatesModalHeaderProps = {
  tFlags: (key: string) => string;
  onClose: () => void;
};

function OfficialTemplatesModalHeader({ tFlags, onClose }: OfficialTemplatesModalHeaderProps) {
  return (
    <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100 p-6 flex items-center justify-between shrink-0 z-10">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
          <Trophy className="w-6 h-6" />
        </div>
        <div>
          <h3 id="official-templates-title" className="text-2xl font-black text-gray-900">
            {tFlags("official.title")}
          </h3>
          <p className="text-sm font-bold text-gray-400">{tFlags("official.subtitle")}</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <X className="w-6 h-6 text-gray-500" />
      </button>
    </div>
  );
}

type OfficialTemplateCardProps = {
  template: OfficialTemplate;
  tFlags: (key: string) => string;
  onTemplateClick: (template: OfficialTemplate) => void;
  onClose: () => void;
};

function OfficialTemplateCard({
  template,
  tFlags,
  onTemplateClick,
  onClose,
}: OfficialTemplateCardProps) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative overflow-hidden rounded-[2rem] p-6 cursor-pointer transition-all duration-300 border border-white/40 shadow-lg hover:shadow-2xl bg-gradient-to-br ${template.gradient} ${template.shadow}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        onTemplateClick(template);
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTemplateClick(template);
          onClose();
        }
      }}
    >
      <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute top-0 left-0 w-full h-full bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div
            className={`w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ${template.color}`}
          >
            <template.icon className="w-7 h-7" />
          </div>
          <div className="px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-md border border-white/40 flex items-center gap-1.5 shadow-sm">
            <ShieldCheck className={`w-3.5 h-3.5 ${template.color}`} />
            <span className={`text-[10px] font-extrabold ${template.color}`}>OFFICIAL</span>
          </div>
        </div>

        <h3 className="text-xl font-black text-gray-900 mb-2 tracking-tight group-hover:translate-x-1 transition-transform duration-300">
          {template.title}
        </h3>
        <p className="text-sm font-bold text-gray-700/90 leading-relaxed line-clamp-2 mb-6 h-10">
          {template.description}
        </p>

        <div
          className={`flex items-center gap-2 text-xs font-black ${template.color} bg-white/80 w-fit px-4 py-2 rounded-xl backdrop-blur-sm shadow-sm group-hover:bg-white group-hover:scale-105 transition-all duration-300`}
        >
          <span className="tracking-wide">{tFlags("official.cta")}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}

function OfficialTemplatesModal({
  isOpen,
  templates,
  tFlags,
  onClose,
  onTemplateClick,
}: OfficialTemplatesModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="official-templates-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 sm:inset-10 z-50 bg-[#F0F2F5] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
          >
            <OfficialTemplatesModalHeader tFlags={tFlags} onClose={onClose} />

            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                {templates.map((tpl) => (
                  <OfficialTemplateCard
                    key={tpl.id}
                    template={tpl}
                    tFlags={tFlags}
                    onTemplateClick={onTemplateClick}
                    onClose={onClose}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

type CheckinModalProps = {
  isOpen: boolean;
  flag: FlagItem | null;
  tFlags: (key: string) => string;
  note: string;
  image: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onNoteChange: (value: string) => void;
  onImageChange: (value: string) => void;
};

type CheckinModalHeaderProps = {
  tFlags: (key: string) => string;
};

function CheckinModalHeader({ tFlags }: CheckinModalHeaderProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
        <Camera className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-2xl font-black text-gray-900">{tFlags("checkin.title")}</h3>
        <p className="text-sm text-gray-500 font-medium">{tFlags("checkin.subtitle")}</p>
      </div>
    </div>
  );
}

type CheckinNoteFieldProps = {
  tFlags: (key: string) => string;
  note: string;
  onNoteChange: (value: string) => void;
};

function CheckinNoteField({ tFlags, note, onNoteChange }: CheckinNoteFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-gray-700 ml-1">{tFlags("checkin.noteLabel")}</label>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder={tFlags("checkin.notePlaceholder")}
        rows={4}
        className="w-full px-5 py-4 rounded-2xl bg-gray-50/80 border border-transparent focus:bg-white focus:border-emerald-500 outline-none transition-all text-gray-900 resize-none font-medium"
      />
    </div>
  );
}

type CheckinImageFieldProps = {
  tFlags: (key: string) => string;
  image: string;
  onImageChange: (value: string) => void;
};

function CheckinImageField({ tFlags, image, onImageChange }: CheckinImageFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-gray-700 ml-1">{tFlags("checkin.imageLabel")}</label>
      <input
        value={image}
        onChange={(e) => onImageChange(e.target.value)}
        placeholder={tFlags("checkin.imagePlaceholder")}
        className="w-full px-5 py-4 rounded-2xl bg-gray-50/80 border border-transparent focus:bg-white focus:border-emerald-500 outline-none transition-all text-gray-900 font-medium"
      />
    </div>
  );
}

type CheckinModalActionsProps = {
  tFlags: (key: string) => string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

function CheckinModalActions({ tFlags, submitting, onClose, onSubmit }: CheckinModalActionsProps) {
  return (
    <div className="flex gap-4 mt-8">
      <button
        onClick={onClose}
        className="flex-1 py-4 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors"
      >
        {tFlags("checkin.cancel")}
      </button>
      <button
        onClick={onSubmit}
        disabled={submitting}
        className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:translate-y-0"
      >
        {submitting ? tFlags("checkin.submitLoading") : tFlags("checkin.submit")}
      </button>
    </div>
  );
}

function CheckinModal({
  isOpen,
  flag,
  tFlags,
  note,
  image,
  submitting,
  onClose,
  onSubmit,
  onNoteChange,
  onImageChange,
}: CheckinModalProps) {
  return (
    <AnimatePresence>
      {isOpen && flag && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-purple-500/10 z-50 p-8 overflow-hidden border border-white/50"
          >
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-50/60 to-transparent pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-200/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <CheckinModalHeader tFlags={tFlags} />

              <div className="space-y-6">
                <CheckinNoteField tFlags={tFlags} note={note} onNoteChange={onNoteChange} />
                <CheckinImageField tFlags={tFlags} image={image} onImageChange={onImageChange} />
              </div>

              <CheckinModalActions
                tFlags={tFlags}
                submitting={submitting}
                onClose={onClose}
                onSubmit={onSubmit}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

type FlagsPageHeaderProps = {
  tFlags: (key: string) => string;
  activeCount: number;
  completedCount: number;
  invitesCount: number;
  inviteNotice: { id: number; title: string } | null;
  viewerId: string;
  flags: FlagItem[];
  statusFilter: "all" | "active" | "success";
  setStatusFilter: (value: "all" | "active" | "success") => void;
  witnessFlags: FlagItem[];
  collectedCount: number;
  onOpenGallery: () => void;
  onOpenHistory: (flag: FlagItem) => void;
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
        想把现实目标和预测市场结合？你可以在{" "}
        <Link href="/trending" className="text-purple-600 hover:text-purple-700 hover:underline">
          热门预测
        </Link>{" "}
        中选择事件创建对应 Flag，在{" "}
        <Link href="/proposals" className="text-purple-600 hover:text-purple-700 hover:underline">
          提案广场
        </Link>{" "}
        发起长期挑战，前往{" "}
        <Link href="/leaderboard" className="text-purple-600 hover:text-purple-700 hover:underline">
          排行榜
        </Link>{" "}
        查看活跃挑战者，并在{" "}
        <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
          讨论区
        </Link>{" "}
        或{" "}
        <Link href="/search" className="text-purple-600 hover:text-purple-700 hover:underline">
          全站搜索
        </Link>{" "}
        中发现更多灵感。
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
};

function FlagsInvitesBanner({
  tFlags,
  invitesCount,
  inviteNotice,
  viewerId,
  flags,
  onOpenHistory,
}: FlagsInvitesBannerProps) {
  if (invitesCount <= 0) {
    return null;
  }

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
          if (!viewerId) return;
          const pending = flags.filter(
            (f) =>
              f.status === "pending_review" &&
              f.verification_type === "witness" &&
              String(f.witness_id || "").toLowerCase() === viewerId
          );
          if (pending.length > 0) {
            onOpenHistory(pending[0]);
          }
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
  statusFilter: "all" | "active" | "success";
  setStatusFilter: (value: "all" | "active" | "success") => void;
};

function FlagsFilterTabs({ tFlags, statusFilter, setStatusFilter }: FlagsFilterTabsProps) {
  return (
    <div className="flex bg白/40 p-1 rounded-xl border border-white/50 backdrop-blur-sm">
      {[
        { id: "all", label: tFlags("filters.all") },
        { id: "active", label: tFlags("filters.active") },
        { id: "success", label: tFlags("filters.success") },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setStatusFilter(tab.id as "all" | "active" | "success")}
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
  if (witnessFlags.length === 0) {
    return null;
  }

  return (
    <button
      onClick={() => {
        if (witnessFlags.length > 0) {
          onOpenHistory(witnessFlags[0]);
        }
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
  statusFilter: "all" | "active" | "success";
  setStatusFilter: (value: "all" | "active" | "success") => void;
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

function FlagsPageHeader({
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

type FlagsMainContentProps = {
  tFlags: (key: string) => string;
  loading: boolean;
  filteredFlags: FlagItem[];
  account: string | null | undefined;
  userId: string | null | undefined;
  onCreate: () => void;
  onCheckin: (flag: FlagItem) => void;
  onOpenHistory: (flag: FlagItem) => void;
  onSettle: (flag: FlagItem) => void;
};

type FlagsCreateCardProps = {
  tFlags: (key: string) => string;
  onCreate: () => void;
};

function FlagsCreateCard({ tFlags, onCreate }: FlagsCreateCardProps) {
  return (
    <motion.div
      layout
      onClick={onCreate}
      className="break-inside-avoid group cursor-pointer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative h-[300px] rounded-[2rem] border-[4px] border-dashed border-gray-300 bg-white/30 hover:bg-white/60 hover:border-purple-300 transition-all duration-300 flex flex-col items-center justify-center gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:rotate-90 transition-all duration-500">
          <Plus className="w-8 h-8 text-gray-400 group-hover:text-purple-500 transition-colors" />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-600 group-hover:text-purple-600 transition-colors">
            {tFlags("createCard.title")}
          </h3>
          <p className="text-xs font-bold text-gray-400 mt-1">{tFlags("createCard.subtitle")}</p>
        </div>
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-gray-200/50 rotate-1 mask-tape"
          style={{ clipPath: "polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)" }}
        />
      </div>
    </motion.div>
  );
}

type FlagsListContainerProps = {
  filteredFlags: FlagItem[];
  account: string | null | undefined;
  userId: string | null | undefined;
  onCheckin: (flag: FlagItem) => void;
  onOpenHistory: (flag: FlagItem) => void;
  onSettle: (flag: FlagItem) => void;
};

function FlagsListContainer({
  filteredFlags,
  account,
  userId,
  onCheckin,
  onOpenHistory,
  onSettle,
}: FlagsListContainerProps) {
  return (
    <AnimatePresence mode="popLayout">
      {filteredFlags.map((flag, index) => (
        <motion.div
          key={flag.id}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          className="break-inside-avoid"
        >
          <FlagCard
            flag={flag}
            isMine={
              Boolean(account || userId) &&
              String(flag.user_id || "").toLowerCase() ===
                String(account || userId || "").toLowerCase()
            }
            onCheckin={() => onCheckin(flag)}
            onViewHistory={() => onOpenHistory(flag)}
            onSettle={() => onSettle(flag)}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function FlagsMainContent({
  tFlags,
  loading,
  filteredFlags,
  account,
  userId,
  onCreate,
  onCheckin,
  onOpenHistory,
  onSettle,
}: FlagsMainContentProps) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-8 pb-20">
      {loading ? (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm font-bold text-gray-400">{tFlags("state.loading")}</p>
        </div>
      ) : (
        <div className="columns-1 md:columns-2 xl:columns-3 2xl:columns-4 gap-8 space-y-8 pb-20 mx-auto">
          <FlagsCreateCard tFlags={tFlags} onCreate={onCreate} />
          <FlagsListContainer
            filteredFlags={filteredFlags}
            account={account}
            userId={userId}
            onCheckin={onCheckin}
            onOpenHistory={onOpenHistory}
            onSettle={onSettle}
          />
        </div>
      )}
    </div>
  );
}

type FlagsModalsProps = {
  tFlags: (key: string) => string;
  officialTemplates: OfficialTemplate[];
  data: FlagsData;
  uiState: FlagsPageViewProps["uiState"];
  uiActions: FlagsPageViewProps["uiActions"];
};

function FlagsModals({ tFlags, officialTemplates, data, uiState, uiActions }: FlagsModalsProps) {
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
    stickerOpen,
    earnedSticker,
    galleryOpen,
    officialCreate,
    officialListOpen,
    selectedTplId,
    tplConfig,
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
    handleReview,
  } = uiActions;

  const allStickerList = dbStickers.length > 0 ? dbStickers : OFFICIAL_STICKERS;

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
      />
    </>
  );
}

type FlagsBackgroundLayoutProps = {
  children: React.ReactNode;
};

function FlagsBackgroundLayout({ children }: FlagsBackgroundLayoutProps) {
  return (
    <div className="h-[calc(100vh-64px)] w-full bg-[#FAFAFA] relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8 flex gap-6">
      <div className="fixed top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-200/40 rounded-full blur-[120px] mix-blend-multiply filter pointer-events-none animate-blob" />
      <div className="fixed top-[20%] right-[-10%] w-[600px] h-[600px] bg-pink-200/40 rounded-full blur-[120px] mix-blend-multiply filter pointer-events-none animate-blob animation-delay-2000" />
      <div className="fixed bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-orange-200/40 rounded-full blur-[120px] mix-blend-multiply filter pointer-events-none animate-blob animation-delay-4000" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 pointer-events-none mix-blend-soft-light" />
      {children}
    </div>
  );
}

export type FlagsPageViewProps = {
  tFlags: (key: string) => string;
  officialTemplates: OfficialTemplate[];
  jsonLd: any;
  account: string | null | undefined;
  userId: string | null | undefined;
  data: FlagsData;
  uiState: {
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
    }>;
    reviewSubmittingId: string | null;
    settlingId: number | null;
    stickerOpen: boolean;
    earnedSticker: StickerItem | null;
    galleryOpen: boolean;
    officialCreate: boolean;
    officialListOpen: boolean;
    selectedTplId: string;
    tplConfig: any;
  };
  uiActions: {
    handleCreateClick: () => void;
    openCheckin: (flag: FlagItem) => void;
    submitCheckin: () => void;
    openHistory: (flag: FlagItem) => void;
    handleReview: (checkinId: string, action: "approve" | "reject") => void;
    settleFlag: (flag: FlagItem) => void;
    handleTemplateClick: (template: OfficialTemplate) => void;
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
  } = data;

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
    stickerOpen,
    earnedSticker,
    galleryOpen,
    officialCreate,
    officialListOpen,
    selectedTplId,
    tplConfig,
  } = uiState;

  const {
    handleCreateClick,
    openCheckin,
    openHistory,
    handleReview,
    settleFlag,
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
