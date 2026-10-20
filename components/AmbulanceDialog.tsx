"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "./Toast";
export default function AmbulanceDialog({ id, title, provider, fare, fee }: { id: string; title: string; provider: string; fare: string; fee: number }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [f, setF] = useState<any>({}); const { data } = useSession(); const router = useRouter();
  const set = (k: string, v: string) => setF((x: any) => ({ ...x, [k]: v }));
  function start() { if (!data?.user) { toast("Please sign in as a patient to book", "err"); return router.push("/login"); } if ((data.user as any).role !== "PATIENT") return toast("Use a patient account to book", "err"); setOpen(true); }
  async function submit() {
    setBusy(true); const r = await fetch("/api/ambulance-bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ambulanceId: id, ...f }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return toast(j.error || "Could not send request", "err"); toast("Request sent to the provider"); router.push("/dashboard");
  }
  return (<>
    <button className="btn" onClick={start}>Request</button>
    {open && <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}><div className="sheet" role="dialog" aria-modal="true" aria-label="Ambulance request">
      <h2>{title}</h2><p style={{ color: "var(--mut)", fontSize: 14 }}>{provider}</p>
      <label htmlFor="ap">Pickup location</label><input id="ap" onChange={(e) => set("pickup", e.target.value)} />
      <label htmlFor="ad">Destination</label><input id="ad" onChange={(e) => set("destination", e.target.value)} />
      <label htmlFor="ac">Your contact number</label><input id="ac" type="tel" inputMode="tel" onChange={(e) => set("contact", e.target.value)} />
      <label htmlFor="at">Requested time</label><input id="at" type="datetime-local" onChange={(e) => set("requestedAt", e.target.value)} />
      <div className="sum"><div><span>Fare (paid directly to provider)</span>{fare}</div><div><span>MediHome confirmation fee</span><b>৳{fee}</b></div></div>
      <div className="banner info">You pay nothing now. If the provider accepts, <b>you (the patient)</b> pay the BDT {fee} fee via bKash to confirm. It is charged once per booking and is separate from the fare. Your number is shown to the provider only after they accept.</div>
      <button className="btn em" style={{ width: "100%" }} disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send request"}</button>
      <button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setOpen(false)}>Cancel</button>
    </div></div>}
  </>);
}
