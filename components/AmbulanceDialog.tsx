"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "./Toast";
import Modal from "./ui/Modal";
import Icon from "./ui/Icon";
import { useI18n } from "./I18nProvider";

// Ambulance request -> success screen. Uses the existing POST /api/ambulance-bookings (the server re-validates).
// The fare is agreed with the provider directly.
export default function AmbulanceDialog({ id, title, provider, fare }: { id: string; title: string; provider: string; fare: string; fee?: number }) {
  const { t } = useI18n(); const a = t.amb, b = t.book;
  const { data } = useSession(); const router = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState<string | null>(null), [tried, setTried] = useState(false);
  const [f, setF] = useState({ pickup: "", destination: "", contact: "", requestedAt: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const missing = { pickup: !f.pickup.trim(), destination: !f.destination.trim(), contact: f.contact.replace(/\D/g, "").length < 8, requestedAt: !f.requestedAt };
  const inv = (k: keyof typeof missing) => (tried && missing[k] ? { "aria-invalid": true as const, "aria-describedby": "am-err" } : {}); // marks each missing field

  function start() {
    if (!data?.user) { toast(b.signIn, "err"); router.push("/login"); return; }
    if ((data.user as any).role !== "PATIENT") { toast(b.patientOnly, "err"); return; }
    setErr(""); setDone(null); setTried(false); setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.values(missing).some(Boolean)) { setErr(a.required); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/ambulance-bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ambulanceId: id, ...f, requestedAt: new Date(f.requestedAt).toISOString() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || a.failed); return; }
      setDone(String(j.id));
    } catch { setErr(a.failed); } finally { setBusy(false); }
  }

  return (<>
    <button className="btn" onClick={start}>{t.ambulance.request}</button>
    {open && <Modal title={done ? a.okTitle : a.title} sub={done ? undefined : `${title} · ${provider}`} onClose={() => setOpen(false)} closeLabel={b.close}>
      {err && <div className="banner warn" role="alert" id="am-err">{err}</div>}
      {!done ? <form onSubmit={submit} noValidate>
        <label htmlFor="am-p">{a.pickup}</label><input id="am-p" {...inv("pickup")} value={f.pickup} maxLength={300} onChange={(e) => set("pickup", e.target.value)} required autoComplete="street-address" />
        <label htmlFor="am-d">{a.destination}</label><input id="am-d" {...inv("destination")} value={f.destination} maxLength={300} onChange={(e) => set("destination", e.target.value)} required />
        <label htmlFor="am-c">{a.contact}</label><input id="am-c" {...inv("contact")} type="tel" inputMode="tel" value={f.contact} maxLength={20} onChange={(e) => set("contact", e.target.value)} required autoComplete="tel" />
        <label htmlFor="am-t">{a.when}</label><input id="am-t" {...inv("requestedAt")} type="datetime-local" value={f.requestedAt} onChange={(e) => set("requestedAt", e.target.value)} required />
        <div className="sum"><div><span>{a.fare}</span>{fare}</div></div>
        <div className="fee">{a.info}</div>
        <div className="sheet-actions"><button type="button" className="btn ghost" data-modal-close>{b.cancel}</button>
          <button className="btn em" disabled={busy} aria-busy={busy}>{busy ? b.wait : a.send}</button></div>
      </form> : <div className="success">
        <span className="success-ic"><Icon name="check" size={34} /></span>
        <p>{a.okText}</p>
        <div className="sum"><div><span>{a.requestId}</span><b className="mono">{done.slice(-8).toUpperCase()}</b></div><div><span>{b.item}</span>{title} · {provider}</div></div>
        <div className="sheet-actions"><button type="button" className="btn ghost" data-modal-close>{b.close}</button><Link className="btn" href="/dashboard">{b.dashboard}</Link></div>
      </div>}
    </Modal>}
  </>);
}
