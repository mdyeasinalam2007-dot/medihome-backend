"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "./Toast";
import Modal from "./ui/Modal";
import { useI18n } from "./I18nProvider";
import { apiError } from "@/lib/i18n/errors";

// PUT /api/me (name, phone) and DELETE /api/me (account deletion). Deletion is checked on the server: the current
// password (or a recent sign-in for Google/Facebook accounts) is required, and the server signs the account out
// on every device. `hasPassword` is only a yes/no flag; no password data ever reaches the browser.
export default function ProfileForm({ name, phone, hasPassword = true }: { name: string; phone: string; hasPassword?: boolean }) {
  const { t, lang } = useI18n(); const p = t.profile;
  const [f, setF] = useState({ name, phone }), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [ask, setAsk] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) { setErr(t.errs.nameRequired); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) toast(p.saved); else setErr(apiError(t, lang, j.error));
    } catch { setErr(t.acts.failed); } finally { setBusy(false); }
  }
  return <form className="card profile" onSubmit={save} noValidate>
    {err && <div className="banner warn" role="alert" id="pf-err">{err}</div>}
    <label htmlFor="pn">{p.name}</label>
    <input id="pn" value={f.name} maxLength={100} autoComplete="name" required onChange={(e) => setF({ ...f, name: e.target.value })}
      {...(err === t.errs.nameRequired ? { "aria-invalid": true, "aria-describedby": "pf-err" } : {})} />
    <label htmlFor="pp">{p.phone}</label>
    <input id="pp" type="tel" inputMode="tel" value={f.phone} maxLength={20} autoComplete="tel" onChange={(e) => setF({ ...f, phone: e.target.value })}
      {...(err === t.errs.phoneTaken ? { "aria-invalid": true, "aria-describedby": "pf-err" } : {})} />
    <div className="row">
      <button className="btn" disabled={busy} aria-busy={busy || undefined}>{busy ? p.saving : p.save}</button>
      <button type="button" className="btn del" onClick={() => setAsk(true)}>{p.del}</button>
    </div>
    {ask && <DeleteDialog hasPassword={hasPassword} onClose={() => setAsk(false)} />}
  </form>;
}

function DeleteDialog({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const { t, lang } = useI18n(); const p = t.profile;
  const [pw, setPw] = useState(""), [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function del() {
    setBusy(true); setErr("");
    const r = await fetch("/api/me", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(hasPassword ? { password: pw } : {}) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) { toast(p.deleted); await signOut({ callbackUrl: "/" }); return; }
    setBusy(false); setErr(r ? apiError(t, lang, j.error, p.delFailed) : p.delFailed);
  }
  const ready = ack && (!hasPassword || pw.length > 0);
  return <Modal title={p.delTitle} onClose={() => !busy && onClose()} closeLabel={t.book.close}>
    <div className="banner warn" role="note">{p.delWhat}</div>
    {err && <div className="banner warn" role="alert" id="del-err">{err}</div>}
    {hasPassword
      ? <><label htmlFor="del-pw">{p.delPw}</label>
        <input id="del-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} {...(err ? { "aria-invalid": true as const, "aria-describedby": "del-err" } : {})} /></>
      : <p className="confirm-text">{p.delOauth}</p>}
    <label className="check del-ack" htmlFor="del-ack"><input id="del-ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>{p.delAck}</span></label>
    <div className="sheet-actions">
      <button type="button" className="btn ghost" data-modal-close disabled={busy}>{t.book.cancel}</button>
      <button type="button" className="btn danger" onClick={del} disabled={!ready || busy} aria-busy={busy || undefined}>{p.delYes}</button>
    </div>
  </Modal>;
}
