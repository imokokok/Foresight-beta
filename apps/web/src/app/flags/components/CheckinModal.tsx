import React from "react";
import { Camera } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { FlagItem } from "@/components/FlagCard";

export type CheckinModalProps = {
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

export function CheckinModal({
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
