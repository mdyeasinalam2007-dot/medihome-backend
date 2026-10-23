"use client";
import { useEffect, useState } from "react";
import AmbulanceActions from "./AmbulanceActions";
import { toast } from "./Toast";
const TYPES = ["Basic ambulance", "AC ambulance", "ICU / advanced life support", "Neonatal ambulance", "Freezing / mortuary van"];
const LABEL: any = { PENDING: "Pending", ACCEPTED: "Accepted (awaiting patient confirmation)", CONFIRMED: "Confirmed", REJECTED: "Rejected", CANCELLED: "Cancelled", COMPLETED: "Completed" };

export default function ProviderPortal({ embedded }: { embedded?: boolean }) {
  const [tab, setTab] = useState("req"), [reqs, setReqs] = useState<any[] | null>(null), [veh, setVeh] = useState<any[] | null>(null), [f, setF] = useState<any>({ type: TYPES[0] });
  const loadR = () => fetch("/api/provider/bookings").then((r) => r.json()).then((j) => setReqs(Array.isArray(j) ? j : []));
  const loadV = () => fetch("/api/provider/vehicles").then((r) => r.json()).then((j) => setVeh(Array.isArray(j) ? j : []));
  useEffect(() => { loadR(); loadV(); }, []);
  // Deep links /provider#requests and /provider#fleet (account menu). Not used when embedded in the hospital portal.
  useEffect(() => {
    if (embedded) return;
    const sync = () => { const h = window.location.hash; if (h === "#requests") setTab("req"); if (h === "#fleet") setTab("veh"); };
    sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync);
  }, [embedded]);
  const go = (k: string) => { setTab(k); if (!embedded) history.replaceState(null, "", k === "req" ? "#requests" : "#fleet"); };
  async function add(e: any) {
    e.preventDefault(); const r = await fetch("/api/provider/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, baseFare: Number(f.baseFare), perKm: Number(f.perKm || 0) }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) return toast(j.error || "Failed", "err"); toast("Ambulance published"); setF({ type: TYPES[0] }); loadV();
  }
  async function call(m: string, id: string) { const r = await fetch(`/api/provider/vehicles?id=${id}`, { method: m }); const j = await r.json().catch(() => ({})); r.ok ? loadV() : toast(j.error || "Failed", "err"); }
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  return <div>{!embedded && <h1>Ambulance <em>Portal</em></h1>}
    <div className="tabs"><button className={"tab " + (tab === "req" ? "on" : "")} onClick={() => go("req")}>Requests</button><button className={"tab " + (tab === "veh" ? "on" : "")} onClick={() => go("veh")}>My ambulances</button></div>
    {tab === "req" && (reqs === null ? <div className="skel" /> : reqs.length ? <div className="grid">{reqs.map((b) => <div className="card" key={b.id}>
      <div className="row" style={{ marginTop: 0 }}><h3>{b.type}</h3><span className="badge">{LABEL[b.status]}</span></div>
      <p>ID {b.id.slice(-8)} · Patient: {b.patient.name}</p><p>Contact: {b.contact}{["PENDING", "REJECTED", "CANCELLED"].includes(b.status) ? " (visible after you accept)" : ""}</p>
      <p>From: {b.pickup}</p><p>To: {b.destination}</p><p>When: {new Date(b.requestedAt).toLocaleString()}</p>
      <AmbulanceActions id={b.id} status={b.status} who="provider" /></div>)}</div> : <div className="empty"><h3>No requests yet</h3><p>Patient requests will appear here.</p></div>)}
    {tab === "veh" && <div><form className="card" onSubmit={add} style={{ maxWidth: 520 }}><h3>Add ambulance</h3>
      <label htmlFor="vt">Type</label><select id="vt" value={f.type} onChange={(e) => set("type", e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      <label htmlFor="vr">Vehicle registration no. (optional)</label><input id="vr" value={f.regNo || ""} onChange={(e) => set("regNo", e.target.value)} />
      <label htmlFor="va">Service area</label><input id="va" required value={f.area || ""} onChange={(e) => set("area", e.target.value)} />
      <div className="two"><div><label htmlFor="vf">Base fare (BDT)</label><input id="vf" type="number" min={0} required value={f.baseFare || ""} onChange={(e) => set("baseFare", e.target.value)} /></div><div><label htmlFor="vk">Per km (BDT)</label><input id="vk" type="number" min={0} value={f.perKm || ""} onChange={(e) => set("perKm", e.target.value)} /></div></div>
      <label htmlFor="vn">Equipment / notes</label><input id="vn" value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} /><div className="row"><button className="btn">Publish</button></div></form>
      <h2 style={{ margin: "18px 0 8px" }}>My ambulances ({veh?.length || 0})</h2><div className="grid">{veh?.length ? veh.map((v) => <div className="card" key={v.id}><h3>{v.type}</h3><p>{v.area} · ৳{v.baseFare}{v.perKm ? ` + ৳${v.perKm}/km` : ""}</p>
        <div className="row"><span className={"badge " + (v.available ? "ok" : "warn")}>{v.available ? "Available" : "Unavailable"}</span><span><button className="btn ghost sm" onClick={() => call("PATCH", v.id)}>Toggle</button> <button className="btn del" onClick={() => confirm("Remove?") && call("DELETE", v.id)}>Remove</button></span></div></div>) : <div className="empty"><h3>No ambulances listed</h3></div>}</div></div>}
  </div>;
}
