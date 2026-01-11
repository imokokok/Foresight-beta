"use client";

import type React from "react";
import { motion } from "framer-motion";
import GradientPage from "@/components/ui/GradientPage";
import DatePicker from "@/components/ui/DatePicker";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import {
  AlignLeft,
  ArrowRight,
  Coins,
  Layout,
  Sparkles,
  Type,
  AlertCircle,
  Plus,
  Trash2,
  Palette,
  Image as ImageIcon,
  Layers,
  Settings2,
  Scale,
  ChevronDown,
  Loader2,
  Save,
  RotateCcw,
  ChevronUp,
  FileText,
  Link2,
} from "lucide-react";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatTime } from "@/lib/format";
import { CATEGORY_MAPPING } from "@/features/trending/trendingModel";
import type { PredictionForm, Outcome } from "../types";
import { useAdminCreatePredictionPage } from "../hooks/useAdminCreatePredictionPage";

type SectionHeaderProps = {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
};

function SectionHeader({ icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-black text-slate-800">{title}</h3>
        <p className="text-xs font-bold text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

type BasicInfoSectionProps = {
  form: PredictionForm;
  setField: (key: keyof PredictionForm, value: PredictionForm[keyof PredictionForm]) => void;
  categoriesData: unknown;
  tTrending: (key: string) => string;
  tTrendingAdmin: (key: string) => string;
};

function BasicInfoSection({
  form,
  setField,
  categoriesData,
  tTrending,
  tTrendingAdmin,
}: BasicInfoSectionProps) {
  return (
    <div className="space-y-8">
      <SectionHeader
        icon={<Layout className="w-5 h-5" />}
        title={tTrendingAdmin("section.basicTitle")}
        subtitle={tTrendingAdmin("section.basicSubtitle")}
      />

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
            <Type className="w-3.5 h-3.5" /> {tTrendingAdmin("fieldTitle")}
          </label>
          <input
            value={form.title}
            onChange={(event) => setField("title", event.target.value)}
            className="input-base !bg-white/60 font-bold text-lg"
            placeholder={tTrendingAdmin("fieldTitlePlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" /> {tTrendingAdmin("fieldCategory")}
          </label>
          <div className="relative">
            <select
              value={form.category}
              onChange={(event) => setField("category", event.target.value)}
              className="input-base !bg-white/60 font-bold appearance-none cursor-pointer"
            >
              {Array.isArray(categoriesData) && (categoriesData as any[]).length > 0 ? (
                (categoriesData as any[]).map((item) => {
                  const name = String((item as any).name || "").trim();
                  if (!name) {
                    return null;
                  }
                  const id = CATEGORY_MAPPING[name] || name;
                  const labelKey = String(id || "");
                  const label =
                    labelKey && labelKey !== name ? tTrending(`category.${labelKey}`) : name;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })
              ) : (
                <>
                  <option value="tech">{tTrending("category.tech")}</option>
                  <option value="entertainment">{tTrending("category.entertainment")}</option>
                  <option value="politics">{tTrending("category.politics")}</option>
                  <option value="weather">{tTrending("category.weather")}</option>
                  <option value="sports">{tTrending("category.sports")}</option>
                  <option value="business">{tTrending("category.business")}</option>
                  <option value="crypto">{tTrending("category.crypto")}</option>
                  <option value="more">{tTrending("category.more")}</option>
                </>
              )}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <DatePicker
            label={tTrendingAdmin("fieldDeadline")}
            value={form.deadline}
            onChange={(value) => setField("deadline", value)}
            includeTime
            placeholder={tTrendingAdmin("deadlinePlaceholder")}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
            <Coins className="w-3.5 h-3.5" /> {tTrendingAdmin("fieldMinStakeLabel")}
          </label>
          <input
            type="number"
            value={form.minStake}
            onChange={(event) => setField("minStake", event.target.value)}
            className="input-base !bg-white/60 font-mono font-bold"
          />
        </div>
      </div>
    </div>
  );
}

type DetailsSectionProps = {
  form: PredictionForm;
  setField: (key: keyof PredictionForm, value: PredictionForm[keyof PredictionForm]) => void;
  tTrendingAdmin: (key: string) => string;
};

function DetailsSection({ form, setField, tTrendingAdmin }: DetailsSectionProps) {
  return (
    <div className="space-y-8">
      <SectionHeader
        icon={<AlignLeft className="w-5 h-5" />}
        title={tTrendingAdmin("section.detailsTitle")}
        subtitle={tTrendingAdmin("section.detailsSubtitle")}
      />

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">
            {tTrendingAdmin("fieldDescription")}
          </label>
          <textarea
            value={form.description}
            onChange={(event) => setField("description", event.target.value)}
            className="input-base !bg-white/60 min-h-[120px] resize-none leading-relaxed font-medium"
            placeholder={tTrendingAdmin("fieldDescriptionPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
            <Scale className="w-3.5 h-3.5" /> {tTrendingAdmin("fieldCriteria")}
          </label>
          <input
            value={form.criteria}
            onChange={(event) => setField("criteria", event.target.value)}
            className="input-base !bg-white/60 font-bold"
            placeholder={tTrendingAdmin("fieldCriteriaPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5" /> {tTrendingAdmin("fieldReferenceUrl")}
          </label>
          <input
            value={form.referenceUrl}
            onChange={(event) => setField("referenceUrl", event.target.value)}
            className="input-base !bg-white/60 font-bold"
            placeholder={tTrendingAdmin("fieldReferenceUrlPlaceholder")}
          />
        </div>
      </div>
    </div>
  );
}

type TypeAndOutcomesSectionProps = {
  type: PredictionForm["type"];
  outcomes: Outcome[];
  setType: (type: PredictionForm["type"]) => void;
  onAddOutcome: () => void;
  onDelOutcome: (index: number) => void;
  onOutcomeChange: (index: number, key: keyof Outcome, value: any) => void;
  tTrendingAdmin: (key: string) => string;
};

function TypeAndOutcomesSection({
  type,
  outcomes,
  setType,
  onAddOutcome,
  onDelOutcome,
  onOutcomeChange,
  tTrendingAdmin,
}: TypeAndOutcomesSectionProps) {
  return (
    <div className="space-y-8">
      <SectionHeader
        icon={<Settings2 className="w-5 h-5" />}
        title={tTrendingAdmin("section.typeTitle")}
        subtitle={tTrendingAdmin("section.typeSubtitle")}
      />

      <div className="space-y-6">
        <div className="flex gap-2 p-1.5 bg-slate-100/50 rounded-2xl w-fit border border-slate-200/60">
          <button
            onClick={() => setType("binary")}
            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
              type === "binary"
                ? "bg-white text-brand shadow-soft border border-white"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {tTrendingAdmin("type.binary")}
          </button>
          <button
            onClick={() => setType("multi")}
            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
              type === "multi"
                ? "bg-white text-brand shadow-soft border border-white"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {tTrendingAdmin("type.multi")}
          </button>
        </div>

        {type === "multi" && (
          <div className="bg-slate-50/50 rounded-[2rem] p-8 border border-slate-200/60 space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-slate-800">
                {tTrendingAdmin("multi.optionsTitle")}
              </div>
              <button
                type="button"
                onClick={onAddOutcome}
                className="px-4 py-2 bg-brand/10 text-brand font-black rounded-xl text-[10px] uppercase tracking-wider hover:bg-brand/20 transition-all flex items-center gap-2 border border-brand/10"
              >
                <Plus className="w-3.5 h-3.5" /> {tTrendingAdmin("multi.addOption")}
              </button>
            </div>

            <div className="space-y-4">
              {outcomes.map((outcome, index) => (
                <div
                  key={index}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white shadow-soft flex flex-col gap-4 group hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">
                      {index + 1}
                    </div>
                    <input
                      value={outcome.label}
                      onChange={(event) => onOutcomeChange(index, "label", event.target.value)}
                      placeholder={tTrendingAdmin("multi.optionLabelPlaceholder")}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 font-black placeholder:text-slate-300 p-0 text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => onDelOutcome(index)}
                      className="p-2 rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 bg-white/50 rounded-xl px-4 py-3 border border-slate-100 focus-within:border-brand/30 transition-all shadow-inner">
                      <AlignLeft className="w-4 h-4 text-slate-400" />
                      <input
                        value={outcome.description || ""}
                        onChange={(event) =>
                          onOutcomeChange(index, "description", event.target.value)
                        }
                        placeholder={tTrendingAdmin("multi.optionDescriptionPlaceholder")}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-600 p-0 placeholder:text-slate-400 font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-3 bg-white/50 rounded-xl px-4 py-3 border border-slate-100 focus-within:border-brand/30 transition-all shadow-inner">
                      <Palette className="w-4 h-4 text-slate-400" />
                      <input
                        value={outcome.color || ""}
                        onChange={(event) => onOutcomeChange(index, "color", event.target.value)}
                        placeholder={tTrendingAdmin("multi.optionColorPlaceholder")}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-600 p-0 placeholder:text-slate-400 font-mono"
                      />
                      {outcome.color && (
                        <div
                          className="w-4 h-4 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: outcome.color }}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 bg-white/50 rounded-xl px-4 py-3 border border-slate-100 focus-within:border-brand/30 transition-all shadow-inner">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      <input
                        value={outcome.image_url || ""}
                        onChange={(event) =>
                          onOutcomeChange(index, "image_url", event.target.value)
                        }
                        placeholder={tTrendingAdmin("multi.optionImagePlaceholder")}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-600 p-0 placeholder:text-slate-400 font-medium"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type SubmitSectionProps = {
  msg: string | null;
  lastSaved: Date | null;
  submitting: boolean;
  showDraftMenu: boolean;
  setShowDraftMenu: (value: boolean) => void;
  manualSaveDraft: () => void;
  clearDraft: () => void;
  submit: () => void;
  tTrendingAdmin: (key: string) => string;
};

function SubmitSection({
  msg,
  lastSaved,
  submitting,
  showDraftMenu,
  setShowDraftMenu,
  manualSaveDraft,
  clearDraft,
  submit,
  tTrendingAdmin,
}: SubmitSectionProps) {
  return (
    <div className="pt-10 border-t border-dashed border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex flex-col gap-2 relative">
        <div className="flex items-center gap-3 text-xs font-bold text-slate-400 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span>{tTrendingAdmin("page.immutableWarning")}</span>
        </div>

        {msg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black w-fit ${
              msg === tTrendingAdmin("createSuccess") ||
              msg === tTrendingAdmin("draft.savedMsg") ||
              msg === tTrendingAdmin("draft.clearedMsg")
                ? "text-emerald-600 bg-emerald-50"
                : "text-red-600 bg-red-50"
            }`}
          >
            {msg}
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-4 w-full md:w-auto">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDraftMenu(!showDraftMenu)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-brand transition-colors px-3 py-2 rounded-lg hover:bg-brand/5 border border-transparent hover:border-brand/10"
          >
            <FileText className="w-3.5 h-3.5" />
            {tTrendingAdmin("draft.menuLabel")}
            <ChevronUp
              className={`w-3.5 h-3.5 transition-transform ${showDraftMenu ? "rotate-180" : ""}`}
            />
          </button>

          {showDraftMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
              <div className="text-[10px] font-black text-slate-400 px-2 py-1 uppercase tracking-wider mb-1">
                {tTrendingAdmin("draft.menuTitle")}
              </div>
              <button
                type="button"
                onClick={() => {
                  manualSaveDraft();
                  setShowDraftMenu(false);
                }}
                className="w-full flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-brand px-2 py-2 rounded-lg hover:bg-brand/5 transition-colors text-left"
              >
                <Save className="w-3.5 h-3.5" />
                {tTrendingAdmin("draft.saveCurrent")}
              </button>

              {lastSaved && (
                <button
                  type="button"
                  onClick={() => {
                    clearDraft();
                    setShowDraftMenu(false);
                  }}
                  className="w-full flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-red-500 px-2 py-2 rounded-lg hover:bg-red-50 transition-colors text-left mt-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {tTrendingAdmin("draft.reset")}
                </button>
              )}
            </div>
          )}
        </div>

        <Button
          disabled={submitting}
          onClick={submit}
          variant="primary"
          className="w-full md:w-64 h-14 rounded-2xl shadow-brand/20 text-lg"
        >
          {submitting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              {tTrendingAdmin("page.submit")} <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function AdminCreatePredictionPage() {
  const {
    router,
    categoriesData,
    tTrending,
    tTrendingAdmin,
    form,
    outcomes,
    submitting,
    showDraftMenu,
    setShowDraftMenu,
    lastSaved,
    msg,
    manualSaveDraft,
    clearDraft,
    draftConfirmOpen,
    draftConfirmMessage,
    closeDraftConfirm,
    confirmDraft,
    setField,
    setType,
    onAddOutcome,
    onDelOutcome,
    onOutcomeChange,
    submit,
  } = useAdminCreatePredictionPage();
  const tAdminRoles = useTranslations("adminRoles");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();

  return (
    <GradientPage className="relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 relative z-10">
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-soft flex items-center justify-center text-brand border border-white/50 rotate-[-3deg]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-[10px] font-black text-brand uppercase tracking-widest">
                {tTrendingAdmin("page.badge")}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-black text-slate-800 tracking-tight">
                {tTrending("actions.createPrediction")}
              </h1>
              {lastSaved && (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white/50 px-3 py-1.5 rounded-full border border-white shadow-sm animate-in fade-in duration-500">
                  <Save className="w-3.5 h-3.5 text-brand" />
                  <span>
                    {tTrendingAdmin("draft.autoSavedPrefix")} {formatTime(lastSaved, locale)}
                  </span>
                </div>
              )}
            </div>
            <p className="text-slate-500 mt-2 font-bold max-w-md leading-relaxed">
              {tTrendingAdmin("page.description")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Button
              variant="subtle"
              onClick={() => router.push("/admin/roles")}
              className="rounded-2xl shadow-soft"
            >
              {tAdminRoles("title")}
            </Button>
            <Button
              variant="subtle"
              onClick={() => router.push("/trending")}
              className="rounded-2xl shadow-soft"
            >
              {tTrendingAdmin("page.backToList")}
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <Card padding="lg" hover={false} className="space-y-12">
            <BasicInfoSection
              form={form}
              setField={setField}
              categoriesData={categoriesData}
              tTrending={tTrending}
              tTrendingAdmin={tTrendingAdmin}
            />
            <DetailsSection form={form} setField={setField} tTrendingAdmin={tTrendingAdmin} />
            <TypeAndOutcomesSection
              type={form.type}
              outcomes={outcomes}
              setType={setType}
              onAddOutcome={onAddOutcome}
              onDelOutcome={onDelOutcome}
              onOutcomeChange={onOutcomeChange}
              tTrendingAdmin={tTrendingAdmin}
            />
            <SubmitSection
              msg={msg}
              lastSaved={lastSaved}
              submitting={submitting}
              showDraftMenu={showDraftMenu}
              setShowDraftMenu={setShowDraftMenu}
              manualSaveDraft={manualSaveDraft}
              clearDraft={clearDraft}
              submit={submit}
              tTrendingAdmin={tTrendingAdmin}
            />
          </Card>
        </motion.div>
      </div>

      <Modal
        open={draftConfirmOpen}
        onClose={closeDraftConfirm}
        role="alertdialog"
        ariaLabelledby="prediction-draft-confirm-title"
        ariaDescribedby="prediction-draft-confirm-desc"
      >
        <div className="bg-white rounded-xl shadow-xl p-5 w-[92vw] max-w-sm border border-gray-100">
          <h3 id="prediction-draft-confirm-title" className="text-sm font-semibold text-gray-900">
            {tCommon("confirm")}
          </h3>
          <p
            id="prediction-draft-confirm-desc"
            className="mt-2 text-sm text-gray-600 whitespace-pre-wrap"
          >
            {draftConfirmMessage}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={closeDraftConfirm}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              onClick={confirmDraft}
            >
              {tCommon("confirm")}
            </button>
          </div>
        </div>
      </Modal>
    </GradientPage>
  );
}
