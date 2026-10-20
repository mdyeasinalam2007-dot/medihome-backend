"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "./Toast";

type P = { type: "DOCTOR" | "BED" | "BLOOD" | "TEST"; hospitalId: string; itemId: string; title: string; hospital: string; fee: number; label?: string; disabled?: boolean;
  slots?: string[]; collection?: string[]; price?: number; bed?: { pricePerDay: number; additional: number; deposit: number }; maxUnits?: number };

export default function BookDialog(p: P) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({ date: new Date().toISOString().slice(0, 10), days: 1, units: 1, time: p.slots?.[0] || "", collection: "LAB" });
  const { data } = useSession(); const router = useRouter();
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const est = p.bed ? p.bed.pricePerDay * (Number(f.days) || 0) + p.bed.additional : 0;

  async function submit() {
    setBusy(true);
    const r = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: p.type, hospitalId: p.hospitalId, itemId: p.itemId, group: p.type === "BLOOD" ? p.itemId : undefined, ...f }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return toast(j.error || "Could not create booking", "err");
    setOpen(false); toast("Booking confirmed successfully", "ok"); router.refresh();
  }
  function start() {
    if (!data?.user) { toast("Please sign in as a patient to book", "err"); return router.push("/login"); }
    if ((data.user as any).role !== "PATIENT") return toast("Use a patient account to book", "err");
    setOpen(true);
  }
  return (<>
    <button className="btn" disabled={p.disabled} onClick={start}>{p.label || "Book"}</button>
    {open && <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}><div className="sheet" role="dialog" aria-modal="true" aria-label="Booking">
      <h2>{p.title}</h2><p style={{ color: "var(--mut)", fontSize: 14 }}>{p.hospital}</p>
      {(p.type === "DOCTOR" || p.type === "TEST" || p.type === "BED") && <><label htmlFor="d">{p.type === "BED" ? "Admission date" : "Preferred date"}</label><input id="d" type="date" min={new Date().toISOString().slice(0, 10)} value={f.date} onChange={(e) => set("date", e.target.value)} /></>}
      {p.type === "DOCTOR" && !!p.slots?.length && <><label htmlFor="t">Time slot</label><select id="t" value={f.time} onChange={(e) => set("time", e.target.value)}>{p.slots.map((s) => <option key={s}>{s}</option>)}</select></>}
      {p.type === "TEST" && (p.collection?.length || 0) > 1 && <><label htmlFor="c">Collection</label><select id="c" value={f.collection} onChange={(e) => set("collection", e.target.value)}><option value="LAB">Lab visit</option><option value="HOME">Home sample collection</option></select></>}
      {p.type === "BED" && <><label htmlFor="n">Expected stay (days)</label><input id="n" type="number" min={1} max={60} value={f.days} onChange={(e) => set("days", e.target.value)} /></>}
      {p.type === "BLOOD" && <><label htmlFor="u">Units needed</label><input id="u" type="number" min={1} max={Math.min(10, p.maxUnits || 10)} value={f.units} onChange={(e) => set("units", e.target.value)} /></>}
      <label htmlFor="o">Note (optional)</label><input id="o" maxLength={500} value={f.note || ""} onChange={(e) => set("note", e.target.value)} />
      <div className="sum">
        {p.type === "BED" && p.bed && <><div><span>Daily rate</span>à§³{p.bed.pricePerDay}</div><div><span>Days</span>{f.days}</div>{p.bed.additional > 0 && <div><span>Additional charges</span>à§³{p.bed.additional}</div>}<div><span>Estimated total (paid to hospital)</span><b>à§³{est}</b></div>{p.bed.deposit > 0 && <div><span>Refundable deposit</span>à§³{p.bed.deposit}</div>}</>}
        {(p.type === "DOCTOR" || p.type === "TEST") && <div><span>{p.type === "DOCTOR" ? "Consultation fee" : "Test price"} (paid to hospital)</span>à§³{p.price}</div>}
        <div><span>MediHome service fee (pay now)</span><b>à§³{p.fee}</b></div>
      </div>
      <div className="fee">Demo mode: no payment is collected. Booking is confirmed automatically. {p.type === "BED" || p.type === "BLOOD" ? "Paying does not guarantee admission or supply: the hospital must confirm clinical suitability and availability, otherwise your fee is refunded." : ""}</div>
      <button className="btn em" style={{ width: "100%" }} disabled={busy} onClick={submit}>{busy ? "Please wait..." : "Confirm booking"}</button>
      <button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setOpen(false)}>Cancel</button>
    </div></div>}
  </>);
}

