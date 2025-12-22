import React from "react";
import DatePicker from "@/components/ui/DatePicker";

type TrendingEditModalProps = {
  open: boolean;
  editForm: any;
  savingEdit: boolean;
  onChangeField: (field: string, value: any) => void;
  onClose: () => void;
  onSubmit: () => void;
  tTrendingAdmin: (key: string) => string;
  tTrending: (key: string) => string;
};

export function TrendingEditModal({
  open,
  editForm,
  savingEdit,
  onChangeField,
  onClose,
  onSubmit,
  tTrendingAdmin,
  tTrending,
}: TrendingEditModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[92vw] max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="text-lg font-semibold mb-4">{tTrendingAdmin("editDialogTitle")}</div>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-600 mb-1">{tTrendingAdmin("fieldTitle")}</div>
            <input
              value={editForm.title}
              onChange={(e) => onChangeField("title", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">{tTrendingAdmin("fieldCategory")}</div>
            <select
              value={editForm.category}
              onChange={(e) => onChangeField("category", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="tech">{tTrending("category.tech")}</option>
              <option value="entertainment">{tTrending("category.entertainment")}</option>
              <option value="politics">{tTrending("category.politics")}</option>
              <option value="weather">{tTrending("category.weather")}</option>
              <option value="sports">{tTrending("category.sports")}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">{tTrendingAdmin("fieldStatus")}</div>
              <select
                value={editForm.status}
                onChange={(e) => onChangeField("status", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="active">active</option>
                <option value="ended">ended</option>
                <option value="settled">settled</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">{tTrendingAdmin("fieldDeadline")}</div>
              <DatePicker
                value={editForm.deadline}
                onChange={(val) => onChangeField("deadline", val)}
                includeTime={true}
                className="w-full"
                placeholder={tTrendingAdmin("deadlinePlaceholder")}
              />
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">{tTrendingAdmin("fieldMinStake")}</div>
            <input
              type="number"
              value={editForm.minStake}
              onChange={(e) => onChangeField("minStake", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">
            {tTrendingAdmin("cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={savingEdit}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50"
          >
            {savingEdit ? tTrendingAdmin("saving") : tTrendingAdmin("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
