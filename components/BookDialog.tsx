"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "./Toast";
import Modal from "./ui/Modal";
import Icon from "./ui/Icon";
import { useI18n } from "./I18nProvider";
import { money, num, fill, localToday, isBookableDate, date as fmtDate } from "@/lib/format";

type P = {
  type: "DOCTOR" | "BED" | "BLOOD" | "TEST"; hospitalId: string; itemId: string; title: string; hospital: string; fee: number;
  label?: string; disabled?: boolean; slots?: string[]; collection?: string[]; price?: number; schedule?: string;
  bed?: { pricePerDay: number; additional: number; deposit: number }; maxUnits?: number;
};
type Step = "form" | "review" | "done";

// After a successful booking the list refreshes (so availability updates), which can re-create this card's
// button. Remember which card opened the dialog so focus can be put back on it for keyboard / screen-reader users.
let refocus: { key: string; until: number } | null = null;
function focusTrigger(btn: HTMLButtonElement | null) {
  if (!btn) return;
  if (!btn.disabled) { btn.focus(); return; }
  const card = btn.closest<HTMLElement>("article"); // e.g. the bed just became full: focus the card instead
  if (card) { card.tabIndex = -1; card.focus(); }
}

// Booking flow: Details -> Review -> Success. Uses the existing POST /api/bookings; the server re-checks
// everything (slot, availability, hospital approval).
export default function BookDialog(p: P) {
  const { t, lang } = useI18n(); const b = t.book;
  const { data } = useSession(); const router = useRouter();
  const [open, setOpen] = useState(false), [step, setStep] = useState<Step>("form"), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [bad, setBad] = useState("");
  const [f, setF] = useState<any>({ date: localToday(), days: 1, units: 1, time: p.slots?.[0] || "", collection: "LAB", note: "" });
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);
  const [refreshing, startRefresh] = useTransition(); // true while the list reloads after a booking
  const stepRef = useRef<HTMLDivElement>(null), btnRef = useRef<HTMLButtonElement>(null);
  const key = p.type + ":" + p.itemId + ":" + p.hospitalId;
  const set = (k: string, v: any) => { setF((x: any) => ({ ...x, [k]: v })); if (k === bad) setBad(""); };
  const inv = (k: string) => (bad === k ? { "aria-invalid": true as const, "aria-describedby": "bd-err" } : {}); // marks the field the error is about
  const request = p.type === "BED" || p.type === "BLOOD";
  const maxUnits = Math.max(1, Math.min(10, p.maxUnits || 10));
  const est = p.bed ? p.bed.pricePerDay * (Number(f.days) || 0) + p.bed.additional : 0;

  useEffect(() => { if (open) stepRef.current?.focus(); }, [step, open]); // announce / move focus to the new step
  useEffect(() => { // the list finished reloading after a booking (this card may be new): put focus back on it
    if (!refreshing && refocus && refocus.key === key && Date.now() < refocus.until) { refocus = null; focusTrigger(btnRef.current); }
  }, [key, p.disabled, refreshing]);

  function start() {
    if (!data?.user) { toast(b.signIn, "err"); router.push("/login"); return; }
    if ((data.user as any).role !== "PATIENT") { toast(b.patientOnly, "err"); return; }
    setStep("form"); setErr(""); setBad(""); setResult(null); setOpen(true);
  }
  function close() {
    setOpen(false);
    // Reload the list so availability / slots update. The button stays disabled until that finishes, so a new
    // dialog can't be opened on a card that is about to be replaced.
    if (result) { refocus = { key, until: Date.now() + 8000 }; startRefresh(() => router.refresh()); }
  }

  function validate(): [string, string] { // [message, field]
    if (p.type !== "BLOOD" && !isBookableDate(f.date, localToday())) return [b.badDate, "date"];
    if (p.type === "BED") { const d = Number(f.days); if (!Number.isInteger(d) || d < 1 || d > 60) return [b.badDays, "days"]; }
    if (p.type === "BLOOD") { const u = Number(f.units); if (!Number.isInteger(u) || u < 1 || u > maxUnits) return [fill(b.badUnits, { n: num(lang, maxUnits) }), "units"]; }
    return ["", ""];
  }
  function toReview(e: React.FormEvent) { e.preventDefault(); const [v, fld] = validate(); setErr(v); setBad(fld); if (!v) setStep("review"); }

  async function submit() {
    setBusy(true); setErr("");
    const body = { type: p.type, hospitalId: p.hospitalId, itemId: p.itemId, group: p.type === "BLOOD" ? p.itemId : undefined,
      date: f.date, time: f.time, days: Number(f.days), units: Number(f.units), collection: f.collection, note: f.note || undefined };
    try {
      const r = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || b.failed); return; }
      setResult({ id: String(j.bookingId), status: String(j.status) }); setStep("done");
    } catch { setErr(b.failed); } finally { setBusy(false); }
  }

  const stepNo = step === "form" ? 1 : step === "review" ? 2 : 3;
  const rows: [string, string][] = [[b.item, p.title], [b.hospital, p.hospital]];
  if (p.type !== "BLOOD") rows.push([b.when, fmtDate(lang, f.date + "T00:00:00")]);
  if (p.type === "DOCTOR") rows.push([b.slot, f.time || b.byAppointment]);
  if (p.type === "TEST" && (p.collection?.length || 0) > 1) rows.push([b.collectionL, f.collection === "HOME" ? b.home : b.lab]);
  if (p.type === "BED") rows.push([b.stay, fill(b.stayDays, { n: num(lang, Number(f.days)) })]);
  if (p.type === "BLOOD") rows.push([b.units, fill(b.unitsN, { n: num(lang, Number(f.units)) })]);

  const prices = <div className="sum">
    {p.type === "BED" && p.bed && <>
      <div><span>{b.dailyRate}</span>{money(lang, p.bed.pricePerDay)}</div>
      {p.bed.additional > 0 && <div><span>{b.additional}</span>{money(lang, p.bed.additional)}</div>}
      <div><span>{b.estimate}</span><b>{money(lang, est)}</b></div>
      {p.bed.deposit > 0 && <div><span>{b.deposit}</span>{money(lang, p.bed.deposit)}</div>}
    </>}
    {(p.type === "DOCTOR" || p.type === "TEST") && !!p.price && <div><span>{p.type === "DOCTOR" ? b.consultFee : b.testPrice}</span>{money(lang, p.price)}</div>}
  </div>;

  return (<>
    <button ref={btnRef} className="btn" disabled={p.disabled || refreshing} aria-busy={refreshing || undefined} onClick={start}>{p.label || t.doctors.book}</button>
    {open && <Modal title={step === "done" ? (result?.status === "CONFIRMED" ? b.okConfirmed : b.okRequested) : step === "review" ? b.reviewTitle : p.title}
      sub={step === "form" ? p.hospital : undefined} onClose={close} closeLabel={b.close}>
      <ol className="stepper" aria-label={fill(b.stepOf, { n: num(lang, stepNo) })}>
        {[b.details, b.review, b.done].map((s, i) => <li key={s} className={i + 1 < stepNo ? "past" : i + 1 === stepNo ? "now" : ""} aria-current={i + 1 === stepNo ? "step" : undefined}>{s}</li>)}
      </ol>
      <div ref={stepRef} tabIndex={-1} className="step-body">
        {err && <div className="banner warn" role="alert" id="bd-err">{err}</div>}

        {step === "form" && <form onSubmit={toReview} noValidate>
          {p.type === "DOCTOR" && p.schedule && <p className="hint"><Icon name="calendar" size={16} />{fill(b.schedule, { v: p.schedule })}</p>}
          {p.type !== "BLOOD" && <><label htmlFor="bd-date">{p.type === "BED" ? b.admissionDate : b.date}</label>
            <input id="bd-date" {...inv("date")} type="date" min={localToday()} value={f.date} onChange={(e) => set("date", e.target.value)} required /></>}
          {p.type === "DOCTOR" && <><label htmlFor="bd-time">{b.time}</label>
            {p.slots?.length ? <select id="bd-time" value={f.time} onChange={(e) => set("time", e.target.value)}>{p.slots.map((s) => <option key={s}>{s}</option>)}</select>
              : <input id="bd-time" value={b.byAppointment} disabled />}</>}
          {p.type === "TEST" && (p.collection?.length || 0) > 1 && <><label htmlFor="bd-col">{b.collection}</label>
            <select id="bd-col" value={f.collection} onChange={(e) => set("collection", e.target.value)}><option value="LAB">{b.lab}</option><option value="HOME">{b.home}</option></select></>}
          {p.type === "BED" && <><label htmlFor="bd-days">{b.days}</label><input id="bd-days" {...inv("days")} type="number" inputMode="numeric" min={1} max={60} value={f.days} onChange={(e) => set("days", e.target.value)} /></>}
          {p.type === "BLOOD" && <><label htmlFor="bd-units">{b.units}</label><input id="bd-units" {...inv("units")} type="number" inputMode="numeric" min={1} max={maxUnits} value={f.units} onChange={(e) => set("units", e.target.value)} />
            <p className="hint">{fill(b.maxUnits, { n: num(lang, maxUnits) })}</p></>}
          <label htmlFor="bd-note">{b.note}</label><input id="bd-note" maxLength={500} value={f.note} onChange={(e) => set("note", e.target.value)} />
          {prices}
          <div className="sheet-actions"><button type="button" className="btn ghost" data-modal-close>{b.cancel}</button><button className="btn">{b.continue}<Icon name="arrow" size={18} /></button></div>
        </form>}

        {step === "review" && <>
          <div className="sum">{rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          {prices}
          <div className="fee">{request ? b.needsConfirm : b.instant}</div>
          <div className="sheet-actions"><button type="button" className="btn ghost" onClick={() => setStep("form")} disabled={busy}>{b.back}</button>
            <button type="button" className="btn em" onClick={submit} disabled={busy} aria-busy={busy}>{busy ? b.wait : request ? b.send : b.confirm}</button></div>
        </>}

        {step === "done" && result && <div className="success">
          <span className="success-ic"><Icon name="check" size={34} /></span>
          <p>{result.status === "CONFIRMED" ? b.okConfirmedText : b.okRequestedText}</p>
          <div className="sum">
            <div><span>{b.bookingId}</span><b className="mono">{result.id.slice(-8).toUpperCase()}</b></div>
            <div><span>{b.status}</span><b>{result.status === "CONFIRMED" ? b.stConfirmed : b.stRequested}</b></div>
            {rows.map(([k, v]) => <div key={k}><span>{k}</span>{v}</div>)}
          </div>
          <div className="sheet-actions"><Link className="btn ghost" href="/dashboard">{b.dashboard}</Link><Link className="btn" href={`/bookings/${result.id}`}>{b.viewBooking}</Link></div>
        </div>}
      </div>
    </Modal>}
  </>);
}
