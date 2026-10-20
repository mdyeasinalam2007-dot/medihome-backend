"use client";
import { useState } from "react";
import { toast } from "./Toast";
export default function ManualPay({ paymentID }: { paymentID: string }) {
  const [trxId, setT] = useState(""), [sender, setS] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: any) {
    e.preventDefault(); setBusy(true);
    const r = await fetch("/api/pay/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentID, trxId, sender }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return toast(j.error || "Could not submit", "err"); window.location.reload();
  }
  return <form onSubmit={submit}>
    <label htmlFor="mt">bKash Transaction ID (TrxID)</label><input id="mt" required value={trxId} onChange={(e) => setT(e.target.value)} placeholder="e.g. 9A1B2C3D4E" autoComplete="off" />
    <label htmlFor="ms">bKash number you paid from</label><input id="ms" required inputMode="numeric" value={sender} onChange={(e) => setS(e.target.value)} placeholder="01XXXXXXXXX" />
    <button className="btn bk" style={{ width: "100%", marginTop: 14 }} disabled={busy}>{busy ? "Submitting…" : "Submit for verification"}</button></form>;
}
