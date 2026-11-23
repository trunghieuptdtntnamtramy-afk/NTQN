import React from "react";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

interface ConfirmModalProps {
  dialog: ConfirmDialogState | null;
  busy?: boolean;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  dialog,
  busy = false,
  onCancel,
}) => {
  if (!dialog || !dialog.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                dialog.isDestructive
                  ? "bg-red-50 text-red-600"
                  : "bg-sky-50 text-sky-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3
              id="confirm-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              {dialog.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            aria-label="Đóng hộp thoại"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          {dialog.description}
        </p>

        {dialog.details && dialog.details.length > 0 && (
          <ul className="mt-3 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {dialog.details.map((item, idx) => (
              <li key={idx} className="truncate">
                • {item}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={dialog.onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
              dialog.isDestructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-sky-700 hover:bg-sky-800"
            }`}
          >
            {busy ? "Đang xử lý..." : dialog.confirmLabel || "Xác nhận thực hiện"}
          </button>
        </div>
      </div>
    </div>
  );
};
