"use client";
import { toast } from "./Toast";
export default function AmbulanceActions({ id, status, who, fee }: { id: string; status: string; who: "patient" | "provider"; fee?: number }) {
  async function act(action: string) {
    const r = await fetch(`/api/ambulance-bookings/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) return toast(j.error || "Failed", "err");
    if (j.url) window.location.href = j.url; else window.location.reload();
  }
  const p = who === "patient";
  return <div className="row">
    {p && status === "ACCEPTED" && <button className="btn em sm" onClick={() => act("pay")}>Pay ৳{fee} to confirm</button>}
    {!p && status === "PENDING" && <><button className="btn em sm" onClick={() => act("accept")}>Accept</button><button className="btn del" onClick={() => act("reject")}>Reject</button></>}
    {!p && status === "CONFIRMED" && <button className="btn sm" onClick={() => act("complete")}>Mark completed</button>}
    {["PENDING", "ACCEPTED", "CONFIRMED"].includes(status) && <button className="btn del" onClick={() => confirm("Cancel this booking?") && act("cancel")}>Cancel</button>}
  </div>;
}
