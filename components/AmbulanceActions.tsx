"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "./Toast";
import ConfirmDialog from "./ui/ConfirmDialog";
import Icon from "./ui/Icon";
import { useI18n } from "./I18nProvider";
import { apiError } from "@/lib/i18n/errors";

// Ambulance request actions (patient and provider). Same API as before: POST /api/ambulance-bookings/[id] { action }.
// The server decides who may do what; demo mode: "pay" confirms without collecting any fee.
export default function AmbulanceActions({ id, status, who }: { id: string; status: string; who: "patient" | "provider"; fee?: number }) {
  const { t, lang } = useI18n(); const a = t.acts;
  const router = useRouter(); const [refreshing, startRefresh] = useTransition();
  const [busy, setBusy] = useState(""), [ask, setAsk] = useState(false);
  const p = who === "patient";

  async function act(action: string, ok: string): Promise<boolean> {
    setBusy(action);
    try {
      const r = await fetch(`/api/ambulance-bookings/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(apiError(t, lang, j.error), "err"); return false; }
      toast(ok); startRefresh(() => router.refresh()); return true;
    } catch { toast(a.failed, "err"); return false; } finally { setBusy(""); }
  }
  const off = !!busy || refreshing, b = (k: string) => (busy === k ? { "aria-busy": true as const } : {});
  const show = (p && status === "ACCEPTED") || (!p && ["PENDING", "CONFIRMED"].includes(status)) || ["PENDING", "ACCEPTED", "CONFIRMED"].includes(status);
  if (!show) return null;
  return <div className="actions compact">
    {p && status === "ACCEPTED" && <button type="button" className="btn em sm" disabled={off} {...b("pay")} onClick={() => act("pay", a.ambConfirmed)}><Icon name="check" size={16} />{a.ambConfirm}</button>}
    {!p && status === "PENDING" && <><button type="button" className="btn em sm" disabled={off} {...b("accept")} onClick={() => act("accept", a.updated)}>{a.accept}</button>
      <button type="button" className="btn del sm" disabled={off} {...b("reject")} onClick={() => act("reject", a.updated)}>{a.reject}</button></>}
    {!p && status === "CONFIRMED" && <button type="button" className="btn sm" disabled={off} {...b("complete")} onClick={() => act("complete", a.updated)}>{a.complete}</button>}
    {["PENDING", "ACCEPTED", "CONFIRMED"].includes(status) && <button type="button" className="btn del sm" disabled={off} onClick={() => setAsk(true)}><Icon name="close" size={16} />{a.ambCancel}</button>}
    {ask && <ConfirmDialog title={a.ambCancelTitle} text={a.ambCancelText} confirmLabel={a.yesCancel} cancelLabel={a.ambKeep} closeLabel={t.book.close} danger
      onConfirm={async () => { await act("cancel", a.ambCancelled); }} onClose={() => setAsk(false)} />}
  </div>;
}
