"use client";
import { useState } from "react";
import { toast } from "./Toast";
import { SUB_LABEL } from "@/lib/constants";

// Site-owner page: approve or suspend hospitals. The admin key lives only in this page's memory
// (not in storage, cookies or the URL) and is sent in the x-owner-key header.
export default function OwnerAdmin() {
  const [key, setKey] = useState(""), [rows, setRows] = useState<any[] | null>(null), [busy, setBusy] = useState(false);
  async function load(k = key) {
    setBusy(true);
    const r = await fetch("/api/owner/hospitals", { headers: { "x-owner-key": k }, cache: "no-store" });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setRows(null); return toast(j.error || "Could not load hospitals", "err"); }
    setRows(j);
  }
  async function act(id: string, action: "approve" | "suspend", name: string) {
    if (!confirm(`${action === "approve" ? "Approve" : "Suspend"} "${name}"?`)) return;
    const r = await fetch("/api/owner/hospitals", { method: "POST", headers: { "Content-Type": "application/json", "x-owner-key": key }, body: JSON.stringify({ id, action }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || "Failed", "err");
    toast(action === "approve" ? "Hospital approved" : "Hospital suspended"); load();
  }
  const pending = (rows || []).filter((h) => h.subStatus !== "ACTIVE" && h.subStatus !== "SUSPENDED");
  return <div>
    <h1>Hospital <em>approvals</em></h1>
    <p className="sub">New hospitals stay hidden from patients until you approve them here.</p>
    {!rows && <form className="card" style={{ maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); load(); }}>
      <label htmlFor="ok">Admin key (OWNER_KEY)</label>
      <input id="ok" type="password" autoComplete="off" required value={key} onChange={(e) => setKey(e.target.value)} />
      <button className="btn" style={{ width: "100%", marginTop: 12 }} disabled={busy}>{busy ? "Checking…" : "Open"}</button>
    </form>}
    {rows && <>
      <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <span className="badge warn">{pending.length} awaiting approval</span>
        <span><button className="btn ghost sm" onClick={() => load()}>Refresh</button> <button className="btn ghost sm" onClick={() => { setRows(null); setKey(""); }}>Lock</button></span>
      </div>
      <div className="grid">{rows.length ? rows.map((h) => <div className="card" key={h.id}>
        <div className="row" style={{ marginTop: 0 }}><h3>{h.name}</h3>
          <span className={"badge " + (h.status === "ACTIVE" ? "ok" : h.status === "SUSPENDED" ? "bad" : "warn")}>{h.subStatus === "PENDING_VERIFICATION" || h.subStatus === "PENDING_PAYMENT" ? "Pending approval" : SUB_LABEL[h.status] || h.status}</span></div>
        <p>{h.address}{h.location ? `, ${h.location}` : ""}</p>
        <p>Licence / registration: <b>{h.license || "—"}</b></p>
        <p>Contact: {h.contactPerson} · {h.phone} · {h.email || "no email"}</p>
        <p>Registered {new Date(h.createdAt).toLocaleDateString()}{h.subExpiresAt ? ` · subscription until ${new Date(h.subExpiresAt).toLocaleDateString()}` : ""}</p>
        <div className="row">
          {h.subStatus !== "ACTIVE" && <button className="btn em sm" onClick={() => act(h.id, "approve", h.name)}>Approve</button>}
          {h.subStatus !== "SUSPENDED" && <button className="btn del" onClick={() => act(h.id, "suspend", h.name)}>{h.subStatus === "ACTIVE" ? "Suspend" : "Reject"}</button>}
        </div>
      </div>) : <div className="empty"><h3>No hospitals registered yet</h3></div>}</div>
    </>}
  </div>;
}
