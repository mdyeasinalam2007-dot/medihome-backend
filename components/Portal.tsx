"use client";
import { useEffect, useState } from "react";
import CrudPanel, { F } from "./CrudPanel";
import ProviderPortal from "./ProviderPortal";
import { toast } from "./Toast";
import { BLOOD_GROUPS, CATEGORIES, AC_CATS, STATUS_LABEL, SUB_LABEL } from "@/lib/constants";

const DOC: F[] = [
  { k: "name", label: "Doctor name" }, { k: "photoUrl", label: "Photo", type: "image" }, { k: "specialty", label: "Specialty" }, { k: "qualification", label: "Qualifications" },
  { k: "experience", label: "Experience (years)", type: "number" }, { k: "feeBdt", label: "Consultation fee (BDT)", type: "number" }, { k: "visitingDays", label: "Visiting days", hint: "e.g. Sat, Mon, Wed" },
  { k: "visitingHours", label: "Visiting hours", hint: "e.g. 5pm - 9pm" }, { k: "slots", label: "Appointment slots", hint: "Comma separated, e.g. 17:00,17:30,18:00" }, { k: "published", label: "Published", type: "bool" } ];
const ACC: F[] = [
  { k: "category", label: "Category", type: "select", opts: CATEGORIES }, { k: "name", label: "Listing name", hint: "e.g. Cardiac ICU" }, { k: "unit", label: "Building / floor / unit" },
  { k: "total", label: "Total capacity", type: "number" }, { k: "available", label: "Available units", type: "number" }, { k: "pricePerDay", label: "Price per day (BDT)", type: "number" },
  { k: "additionalCharge", label: "Admission / additional charge (BDT)", type: "number" }, { k: "deposit", label: "Refundable deposit (BDT)", type: "number" },
  { k: "ac", label: "AC / Non-AC", type: "nbool", showIf: (f) => AC_CATS.includes(f.category) },
  { k: "sharing", label: "Private / shared", type: "select", opts: [["PRIVATE", "Private"], ["SHARED", "Shared"]] }, { k: "occupants", label: "Occupants per room", type: "number" },
  { k: "attachedBath", label: "Attached bathroom", type: "bool" }, { k: "facilityLevel", label: "Facility level", type: "select", opts: [["BASIC", "Basic"], ["STANDARD", "Standard"], ["PREMIUM", "Premium"]] },
  { k: "equipment", label: "Equipment & care facilities", type: "area" }, { k: "notes", label: "Eligibility / admission notes", type: "area" }, { k: "published", label: "Published", type: "bool" } ];
const TST: F[] = [
  { k: "name", label: "Test name" }, { k: "category", label: "Category" }, { k: "priceBdt", label: "Price (BDT)", type: "number" }, { k: "preparation", label: "Preparation instructions", type: "area" },
  { k: "availableDays", label: "Available days" }, { k: "slots", label: "Time slots" }, { k: "collection", label: "Collection options", type: "select", opts: [["LAB", "Lab visit only"], ["LAB,HOME", "Lab visit + home collection"]], hint: "Offer home collection only if genuinely supported" },
  { k: "reportTime", label: "Estimated report time" }, { k: "published", label: "Published", type: "bool" } ];
const PRO: F[] = [
  { k: "name", label: "Hospital name" }, { k: "photoUrl", label: "Hospital photo", type: "image" }, { k: "contactPerson", label: "Contact person" }, { k: "phone", label: "Official phone" },
  { k: "address", label: "Address" }, { k: "location", label: "City / area" }, { k: "emergency", label: "Emergency contact" }, { k: "license", label: "Licence / registration no." },
  { k: "description", label: "Description", type: "area" }, { k: "facilities", label: "Facilities", type: "area" }, { k: "bloodNote", label: "Blood bank requirements / process", type: "area" } ];

function Blood({ locked }: { locked: boolean }) {
  const [v, setV] = useState<any>({});
  useEffect(() => { fetch("/api/hospital/blood").then((r) => r.json()).then((rows) => setV(Object.fromEntries((rows || []).map((x: any) => [x.group, x.units])))); }, []);
  async function save() { const r = await fetch("/api/hospital/blood", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(BLOOD_GROUPS.map((g) => [g, v[g] || 0]))) }); const j = await r.json(); r.ok ? toast("Stock updated") : toast(j.error, "err"); }
  return <div><p className="sub">Enter actual units available per group. Stock is reduced only when you confirm a blood request.</p>
    <div className="grid">{BLOOD_GROUPS.map((g) => <div className="card" key={g}><h3 style={{ color: "var(--red)" }}>{g}</h3><label htmlFor={"b" + g}>Units</label><input id={"b" + g} type="number" min={0} value={v[g] ?? 0} onChange={(e) => setV({ ...v, [g]: e.target.value })} /></div>)}</div>
    <button className="btn" style={{ marginTop: 14 }} disabled={locked} onClick={save}>Save blood stock</button></div>;
}

function Bookings() {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => fetch("/api/hospital/bookings").then((r) => r.json()).then((j) => setRows(Array.isArray(j) ? j : []));
  useEffect(() => { load(); }, []);
  async function act(id: string, action: string) { const note = action === "reject" ? prompt("Reason (optional)") || "" : ""; const r = await fetch(`/api/hospital/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) }); const j = await r.json(); r.ok ? load() : toast(j.error, "err"); }
  if (!rows) return <div className="skel" />;
  if (!rows.length) return <div className="empty"><div className="ic">📥</div><h3>No incoming bookings</h3><p>Paid patient requests will appear here.</p></div>;
  return <div className="grid">{rows.map((b) => <div className="card" key={b.id}>
    <div className="row" style={{ marginTop: 0 }}><h3>{b.itemName}</h3><span className="badge">{STATUS_LABEL[b.status]}</span></div>
    <p>{b.type} · ID {b.id.slice(-8)}</p><p>Patient: {b.patient.name} {b.patient.phone && `· ${b.patient.phone}`}</p>
    <p>{b.startDate ? "Date: " + b.startDate.slice(0, 10) : ""} {b.apptTime || ""} {b.days ? `· ${b.days} days` : ""} {b.units ? `· ${b.units} units` : ""}</p>
    {b.baseAmount > 0 && <p>Estimated hospital charge: ৳{b.baseAmount + b.extraAmount}{b.depositAmount ? ` (+৳${b.depositAmount} deposit)` : ""}</p>}
    <p>Service fee ৳{b.feeBdt}: {b.payments.some((p: any) => p.status === "COMPLETED") ? "Paid" : "Unpaid"}</p>{b.note && <p>Note: {b.note}</p>}
    {b.history?.length > 0 && <p>History: {b.history.map((h: any) => h.action.replace("BOOKING_", "").toLowerCase()).join(" → ")}</p>}
    <div className="row">
      {b.status === "PAID" && <button className="btn em sm" onClick={() => act(b.id, "confirm")}>Confirm</button>}
      {b.status === "CONFIRMED" && <button className="btn sm" onClick={() => act(b.id, "complete")}>Mark completed</button>}
      {["PAID", "CONFIRMED"].includes(b.status) && <button className="btn del" onClick={() => act(b.id, "reject")}>Reject (refund)</button>}</div></div>)}</div>;
}

function Billing({ b, reload }: { b: any; reload: () => void }) {
  async function pay() { const r = await fetch("/api/hospital/billing", { method: "POST" }); const j = await r.json(); r.ok ? (window.location.href = j.url) : toast(j.error, "err"); }
  if (!b) return <div className="skel" />;
  return <div className="card" style={{ maxWidth: 560 }}>
    <h3>Subscription</h3><p>Status: <span className={"badge " + (b.status === "ACTIVE" ? "ok" : "warn")}>{SUB_LABEL[b.status]}</span></p>
    {b.expiresAt && <p>{b.status === "ACTIVE" ? "Renews by" : "Expired on"}: {new Date(b.expiresAt).toLocaleDateString()}</p>}
    <div className="sum"><div><span>One-time registration (includes first 30 days)</span>৳{b.regFee}</div><div><span>Monthly renewal</span>৳{b.monthlyFee}</div>{b.destination && <div><span>Payment destination</span>{b.destination}</div>}</div>
    {b.mode === "mock" && <div className="banner warn" style={{ marginTop: 12 }}>TEST MODE: bKash credentials are not configured, so payments are simulated and no real money moves.</div>}
    {b.mode === "manual" && <div className="banner info" style={{ marginTop: 12 }}>Manual bKash payment: you will be shown where to send money, then submit your bKash transaction ID. Activation happens after the payment is verified.</div>}
    {b.status !== "SUSPENDED" && b.status !== "ACTIVE" && <button className="btn em" style={{ marginTop: 12 }} onClick={pay}>{b.regPaid ? `Pay ৳${b.monthlyFee} to renew` : `Pay ৳${b.regFee} registration`}</button>}
    {b.status === "ACTIVE" && b.regPaid && <button className="btn ghost" style={{ marginTop: 12 }} onClick={pay}>Renew early (+30 days) ৳{b.monthlyFee}</button>}
    <p style={{ fontSize: 12, marginTop: 10 }}>While inactive you can view bookings and billing, but cannot publish listings or accept new bookings, and your listings are hidden from patients.</p>
    <h3 style={{ marginTop: 16 }}>Payment history</h3>{(b.payments ?? []).length ? <table><tbody>{b.payments.map((p: any) => <tr key={p.id}><td>{new Date(p.createdAt).toLocaleDateString()}</td><td>{p.purpose}</td><td>৳{p.amount}</td><td>{p.status}</td><td>{p.trxId || ""}</td></tr>)}</tbody></table> : <p>No payments yet.</p>}</div>;
}

export default function Portal() {
  const [b, setB] = useState<any>(null), [tab, setTab] = useState("bookings");
  const reload = () => fetch("/api/hospital/billing").then((r) => r.json()).then(setB);
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (b && b.status !== "ACTIVE") setTab("billing"); }, [b?.status]);
  const locked = !!b && b.status !== "ACTIVE";
  const T = [["bookings", "Bookings"], ["doctors", "Doctors"], ["accommodations", "Beds & rooms"], ["blood", "Blood stock"], ["tests", "Tests"], ["ambulance", "Ambulance"], ["profile", "Profile"], ["billing", "Billing"]];
  return <div>
    <h1>Hospital <em>Portal</em></h1>
    {locked && <div className="banner warn">Your listing is hidden and new bookings are paused until the subscription is active. Open the Billing tab.</div>}
    {b?.status === "ACTIVE" && <div className="banner ok">Subscription active until {new Date(b.expiresAt).toLocaleDateString()}.</div>}
    <div className="tabs" role="tablist">{T.map((t) => <button key={t[0]} role="tab" aria-selected={tab === t[0]} className={"tab " + (tab === t[0] ? "on" : "")} onClick={() => setTab(t[0])}>{t[1]}</button>)}</div>
    {tab === "bookings" && <Bookings />}
    {tab === "doctors" && <CrudPanel resource="doctors" fields={DOC} locked={locked} show={["specialty", "feeBdt", "visitingHours"]} />}
    {tab === "accommodations" && <CrudPanel resource="accommodations" fields={ACC} locked={locked} show={["category", "available", "total", "pricePerDay"]} />}
    {tab === "blood" && <Blood locked={locked} />}
    {tab === "tests" && <CrudPanel resource="tests" fields={TST} locked={locked} show={["priceBdt", "category"]} />}
    {tab === "ambulance" && <ProviderPortal embedded />}
    {tab === "profile" && <CrudPanel resource="profile" fields={PRO} single />}
    {tab === "billing" && <Billing b={b} reload={reload} />}
  </div>;
}
