"use client";
import { toast } from "./Toast";
export default function BookingActions({ id, status }: { id: string; status: string }) {
  async function act(action: string) {
    const r = await fetch(`/api/bookings/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || "Failed", "err");
    if (j.url) window.location.href = j.url; else window.location.reload();
  }
  return <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
    {status === "AWAITING_PAYMENT" && <button className="btn em" onClick={() => act("pay")}>Pay service fee</button>}
    {["AWAITING_PAYMENT", "PAID", "CONFIRMED"].includes(status) && <button className="btn del" onClick={() => confirm("Cancel this booking?") && act("cancel")}>Cancel booking</button>}
  </div>;
}
