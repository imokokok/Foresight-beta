import React from "react";
import { ArrowRight, ShieldCheck, Trophy, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { OfficialTemplate } from "../flagsConfig";

export type OfficialTemplatesModalProps = {
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

export function OfficialTemplatesModal({
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
