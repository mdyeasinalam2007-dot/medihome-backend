"use client";
import { useState } from "react";
import Modal from "./Modal";

// Accessible replacement for window.confirm(): translated, styled, keyboard-friendly.
// onConfirm may be async; the dialog shows a busy state and stays open if it returns false.
export default function ConfirmDialog({ title, text, confirmLabel, cancelLabel, closeLabel, danger, onConfirm, onClose }: {
  title: string; text: string; confirmLabel: string; cancelLabel: string; closeLabel: string; danger?: boolean;
  onConfirm: () => Promise<boolean | void> | boolean | void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try { const keepOpen = (await onConfirm()) === false; if (!keepOpen) onClose(); } finally { setBusy(false); }
  }
  return (
    <Modal title={title} onClose={() => !busy && onClose()} closeLabel={closeLabel}>
      <p className="confirm-text">{text}</p>
      <div className="sheet-actions">
        <button type="button" className="btn ghost" data-modal-close data-autofocus disabled={busy}>{cancelLabel}</button>
        <button type="button" className={"btn " + (danger ? "danger" : "")} onClick={go} disabled={busy} aria-busy={busy || undefined}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
