"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "./Toast";
import ConfirmDialog from "./ui/ConfirmDialog";
import Icon from "./ui/Icon";
import { useI18n } from "./I18nProvider";
import { apiError } from "@/lib/i18n/errors";

// Patient actions on their own booking. Same API as before: POST /api/bookings/[id] { action: "pay" | "cancel" }.
// The server decides what is allowed (guarded status changes); these buttons only mirror that.
export default function BookingActions({ id, status, compact }: { id: string; status: string; compact?: boolean }) {
  const { t, lang } = useI18n(); const a = t.acts;
  const router = useRouter(); const [refreshing, startRefresh] = useTransition();
  const [busy, setBusy] = useState(""), [ask, setAsk] = useState(false);
  const canSubmit = status === "AWAITING_PAYMENT", canCancel = ["AWAITING_PAYMENT", "REQUESTED", "PAID", "CONFIRMED"].includes(status);
  if (!canSubmit && !canCancel) return null;

  async function act(action: "pay" | "cancel"): Promise<boolean> {
    setBusy(action);
    try {
      const r = await fetch(`/api/bookings/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(apiError(t, lang, j.error), "err"); return false; }
      toast(action === "pay" ? a.submitted : a.cancelled);
      startRefresh(() => router.refresh());
      return true;
    } catch { toast(a.failed, "err"); return false; } finally { setBusy(""); }
  }
  const off = !!busy || refreshing;
  return <div className={"actions" + (compact ? " compact" : "")}>
    {canSubmit && <button type="button" className={"btn em" + (compact ? " sm" : "")} disabled={off} aria-busy={busy === "pay" || undefined} onClick={() => act("pay")}>{a.submit}</button>}
    {canCancel && <button type="button" className={"btn del" + (compact ? " sm" : "")} disabled={off} onClick={() => setAsk(true)}><Icon name="close" size={16} />{a.cancel}</button>}
    {ask && <ConfirmDialog title={a.cancelTitle} text={a.cancelText} confirmLabel={a.yesCancel} cancelLabel={a.keep} closeLabel={t.book.close} danger
      onConfirm={async () => { await act("cancel"); }} onClose={() => setAsk(false)} />}
  </div>;
}
