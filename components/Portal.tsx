"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import CrudPanel, { type F, type Summary } from "./CrudPanel";
import ProviderPortal from "./ProviderPortal";
import { toast } from "./Toast";
import StatusBadge from "./StatusBadge";
import Modal from "./ui/Modal";
import Icon, { type IconName } from "./ui/Icon";
import { useI18n } from "./I18nProvider";
import { BLOOD_GROUPS, CATEGORIES, AC_CATS } from "@/lib/constants";
import { bookingTone } from "@/lib/status";
import { apiError } from "@/lib/i18n/errors";
import { date, day, fill, has, money, num, plural } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n/dictionaries";

// Hospital portal. Same APIs, rules and permissions as before; only the presentation changed.
// Every action is still checked on the server (ownership, approval and subscription status).

const DOC: F[] = [{ k: "name" }, { k: "photoUrl", type: "image" }, { k: "specialty" }, { k: "qualification" }, { k: "experience", type: "number" }, { k: "feeBdt", type: "number" },
  { k: "visitingDays" }, { k: "visitingHours" }, { k: "slots", wide: true }, { k: "published", type: "bool" }];
const ACC: F[] = [{ k: "category", type: "select", opts: CATEGORIES.map((c) => c[0]), optsFrom: "cats" }, { k: "name" }, { k: "unit", wide: true },
  { k: "total", type: "number" }, { k: "available", type: "number" }, { k: "pricePerDay", type: "number" }, { k: "additionalCharge", type: "number" }, { k: "deposit", type: "number" },
  { k: "ac", type: "nbool", showIf: (f) => AC_CATS.includes(f.category) }, { k: "sharing", type: "select", opts: ["PRIVATE", "SHARED"] }, { k: "occupants", type: "number" },
  { k: "attachedBath", type: "bool" }, { k: "facilityLevel", type: "select", opts: ["BASIC", "STANDARD", "PREMIUM"] }, { k: "equipment", type: "area" }, { k: "notes", type: "area" }, { k: "published", type: "bool" }];
const TST: F[] = [{ k: "name" }, { k: "category" }, { k: "priceBdt", type: "number" }, { k: "reportTime" }, { k: "availableDays" }, { k: "slots" },
  { k: "collection", type: "select", opts: ["LAB", "LAB,HOME"], wide: true }, { k: "preparation", type: "area" }, { k: "published", type: "bool" }];
const PRO: F[] = [{ k: "name", group: "basic", wide: true }, { k: "photoUrl", type: "image" }, { k: "license" }, { k: "location" },
  { k: "contactPerson", group: "contact" }, { k: "phone" }, { k: "emergency" }, { k: "address", wide: true },
  { k: "description", type: "area", group: "about" }, { k: "facilities", type: "area" }, { k: "bloodNote", type: "area" }];

const docSum = (r: any, t: Dict, lang: Lang): Summary => ({ title: r.name, img: r.photoUrl || "", lines: [
  ...(has(r.specialty) ? [["doctor", r.specialty]] : []), ...(has(r.feeBdt) ? [["card", fill(t.portal.fee, { p: money(lang, r.feeBdt) })]] : []),
  ...(has(r.visitingDays) || has(r.visitingHours) ? [["calendar", [r.visitingDays, r.visitingHours].filter(has).join(" · ")]] : []),
  ...(has(r.experience) ? [["check", fill(t.portal.years, { n: num(lang, r.experience) })]] : []) ] as [IconName, string][] });
const accSum = (r: any, t: Dict, lang: Lang): Summary => ({ title: r.name || t.cats[r.category] || r.category, meter: [r.available || 0, r.total || 0], lines: [
  ...(r.name ? [["bed", t.cats[r.category] || r.category]] : []), ["check", fill(t.portal.avail, { a: num(lang, r.available || 0), t: num(lang, r.total || 0) })],
  ...(has(r.pricePerDay) ? [["card", fill(t.portal.perDay, { p: money(lang, r.pricePerDay) })]] : []) ] as [IconName, string][] });
const tstSum = (r: any, t: Dict, lang: Lang): Summary => ({ title: r.name, lines: [
  ...(has(r.category) ? [["test", r.category]] : []), ...(has(r.priceBdt) ? [["card", money(lang, r.priceBdt)]] : []),
  ...(has(r.reportTime) ? [["clock", fill(t.portal.report, { r: r.reportTime })]] : []) ] as [IconName, string][] });

const TABS: [string, IconName][] = [["bookings", "inbox"], ["doctors", "doctor"], ["accommodations", "bed"], ["blood", "blood"], ["tests", "test"], ["ambulance", "ambulance"], ["profile", "hospital"], ["billing", "card"]];
const TYPE_ICON: Record<string, IconName> = { DOCTOR: "doctor", BED: "bed", BLOOD: "blood", TEST: "test" };
const NEW = ["REQUESTED", "PAID"];
const inFilter = (s: string, fl: string) => fl === "all" || (fl === "new" ? NEW.includes(s) : fl === "confirmed" ? s === "CONFIRMED" : !NEW.includes(s) && s !== "CONFIRMED");
// Status of the hospital account as one key (display only).
const accountKey = (b: any) => !b ? null : b.status === "SUSPENDED" ? "SUSPENDED" : b.approved === false ? "PENDING" : b.status === "ACTIVE" ? "ACTIVE" : "PAST_DUE";

function Blood({ locked }: { locked: boolean }) {
  const { t, lang } = useI18n(); const p = t.portal;
  const [v, setV] = useState<any>({}), [state, setState] = useState<"load" | "ok" | "err">("load"), [busy, setBusy] = useState(false);
  const load = () => { setState("load"); fetch("/api/hospital/blood").then((r) => r.ok ? r.json() : Promise.reject()).then((rows) => { setV(Object.fromEntries((rows || []).map((x: any) => [x.group, x.units]))); setState("ok"); }).catch(() => setState("err")); };
  useEffect(load, []);
  async function save() {
    setBusy(true);
    const r = await fetch("/api/hospital/blood", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(BLOOD_GROUPS.map((g) => [g, v[g] || 0]))) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    r.ok ? toast(p.bloodSaved) : toast(apiError(t, lang, j.error), "err");
  }
  const n = (g: string) => Math.max(0, Math.floor(Number(v[g]) || 0));
  const step = (g: string, d: number) => setV({ ...v, [g]: Math.max(0, n(g) + d) });
  if (state === "load") return <div className="skel tall" />;
  if (state === "err") return <Retry onRetry={load} />;
  const total = BLOOD_GROUPS.reduce((a, g) => a + n(g), 0);
  return <div>
    <p className="panel-note"><Icon name="alert" size={16} />{p.bloodSub}</p>
    <ul className="blood-grid">{BLOOD_GROUPS.map((g) => <li key={g} className={"card blood-tile" + (n(g) === 0 ? " out" : "")}>
      <div className="bt-head"><span className="bt-group">{g}</span>
        {n(g) > 0 ? <span className="badge ok"><Icon name="check" size={14} />{p.inStock}</span> : <span className="badge bad">{p.outOfStock}</span>}</div>
      <label htmlFor={"b" + g}>{p.units}</label>
      <div className="qty">
        <button type="button" className="icon-btn" aria-label={fill(p.dec, { g })} disabled={locked || n(g) === 0} onClick={() => step(g, -1)}>−</button>
        <input id={"b" + g} type="number" inputMode="numeric" min={0} value={v[g] ?? 0} disabled={locked} onChange={(e) => setV({ ...v, [g]: e.target.value })} />
        <button type="button" className="icon-btn" aria-label={fill(p.inc, { g })} disabled={locked} onClick={() => step(g, 1)}>+</button>
      </div>
    </li>)}</ul>
    <div className="save-bar"><span className="save-total">{fill(p.total, { n: plural(lang, total, t.plural.unitOne, t.plural.unitMany) })}</span>
      <button className="btn" disabled={locked || busy} aria-busy={busy || undefined} onClick={save}>{p.saveBlood}</button></div>
  </div>;
}

function Retry({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return <div className="empty error" role="alert"><span className="empty-ic"><Icon name="alert" size={28} /></span><h3>{t.portal.loadFailed}</h3>
    <p className="empty-act"><button type="button" className="btn sm" onClick={onRetry}>{t.portal.retry}</button></p></div>;
}

function BookingCard({ b, onAct, onReject }: { b: any; onAct: (id: string, a: string) => void; onReject: (b: any) => void }) {
  const { t, lang } = useI18n(); const p = t.portal;
  const when = b.startDate ? day(lang, b.startDate) + (b.apptTime ? " · " + b.apptTime : "") : null;
  const extra = [b.type === "BED" && has(b.days) ? plural(lang, b.days, t.plural.dayOne, t.plural.dayMany) : "",
    has(b.units) && b.type === "BLOOD" ? plural(lang, b.units, t.plural.unitOne, t.plural.unitMany) : ""].filter(Boolean);
  const hist = [...(b.history || [])].reverse().map((h: any) => p.hist[String(h.action).replace(/^BOOKING_/, "").replace(/_DEMO$/, "")] || p.histOther);
  return <article className={"card item booking-card hb-card" + (NEW.includes(b.status) ? " is-new" : "")}>
    <div className="item-head between">
      <span className="type-chip"><Icon name={TYPE_ICON[b.type] || "calendar"} size={16} />{t.types[b.type] || b.type}</span>
      <StatusBadge tone={bookingTone(b.status)} label={p.hst[b.status] || b.status} />
    </div>
    <h3>{b.itemName}</h3>
    <p className="meta"><Icon name="user" size={16} /><span><span className="sr-only">{p.patient}: </span>{b.patient?.name}{b.patient?.phone ? " · " + b.patient.phone : ""}</span></p>
    {when && <p className="meta"><Icon name="calendar" size={16} /><b className="when">{when}</b></p>}
    {extra.length > 0 && <p className="meta"><Icon name="check" size={16} />{extra.join(" · ")}</p>}
    {b.baseAmount > 0 && <p className="meta"><Icon name="card" size={16} />{p.charge}: {money(lang, b.baseAmount + b.extraAmount)}{b.depositAmount ? " " + fill(p.deposit, { n: money(lang, b.depositAmount) }) : ""}</p>}
    {has(b.note) && <p className="hb-note"><b>{p.note}:</b> {b.note}</p>}
    {has(b.hospitalNote) && <p className="hb-note mine"><b>{p.yourNote}:</b> {b.hospitalNote}</p>}
    <ol className="hb-hist" aria-label={p.history}>
      <li>{fill(p.received, { d: date(lang, b.createdAt) })}</li>{hist.map((h, i) => <li key={i}>{h}</li>)}
    </ol>
    <p className="stamp">{t.dash.id} <span className="mono">{b.id.slice(-8).toUpperCase()}</span></p>
    {["REQUESTED", "PAID", "CONFIRMED"].includes(b.status) && <div className="item-foot hb-actions">
      {NEW.includes(b.status) && <button className="btn em sm" onClick={() => onAct(b.id, "confirm")}><Icon name="check" size={16} />{p.confirm}</button>}
      {b.status === "CONFIRMED" && <button className="btn sm" onClick={() => onAct(b.id, "complete")}><Icon name="check" size={16} />{p.complete}</button>}
      <button className="btn del sm" onClick={() => onReject(b)}>{p.reject}</button>
    </div>}
  </article>;
}

function RejectDialog({ b, onClose, onDone }: { b: any; onClose: () => void; onDone: (note: string) => Promise<boolean> }) {
  const { t } = useI18n(); const p = t.portal;
  const [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  async function go() { setBusy(true); const ok = await onDone(note); setBusy(false); if (ok) onClose(); }
  return <Modal title={p.rejectTitle} sub={b.itemName} onClose={() => !busy && onClose()} closeLabel={t.book.close}>
    <p className="confirm-text">{p.rejectText}</p>
    <label htmlFor="rj-note">{p.reason}</label>
    <textarea id="rj-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby="rj-hint" />
    <p className="hint" id="rj-hint">{p.reasonHint}</p>
    <div className="sheet-actions">
      <button type="button" className="btn ghost" data-modal-close disabled={busy}>{p.keep}</button>
      <button type="button" className="btn danger" onClick={go} disabled={busy} aria-busy={busy || undefined}>{p.yesReject}</button>
    </div>
  </Modal>;
}

function Bookings({ rows, failed, reload, filter, setFilter }: { rows: any[] | null; failed: boolean; reload: () => void; filter: string; setFilter: (f: string) => void }) {
  const { t, lang } = useI18n(); const p = t.portal;
  const [rej, setRej] = useState<any>(null);
  // Same request as before: PATCH /api/hospital/bookings/<id> { action, note }.
  async function act(id: string, action: string, note = "") {
    const r = await fetch(`/api/hospital/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(apiError(t, lang, j.error), "err"); reload(); return false; }
    toast(action === "confirm" ? p.confirmedT : action === "complete" ? p.completedT : p.rejectedT); reload(); return true;
  }
  if (failed) return <Retry onRetry={reload} />;
  if (!rows) return <div className="grid"><div className="skel" /><div className="skel" /></div>;
  if (!rows.length) return <div className="empty"><span className="empty-ic"><Icon name="inbox" size={28} /></span><h3>{p.emptyBookingsT}</h3><p>{p.emptyBookings}</p></div>;
  const list = rows.filter((b) => inFilter(b.status, filter));
  return <>
    <div className="chip-row on-page" role="group" aria-label={p.filterLabel}>
      {["all", "new", "confirmed", "closed"].map((k) => <button key={k} type="button" className={"chip" + (filter === k ? " on" : "")} aria-pressed={filter === k} onClick={() => setFilter(k)}>
        {p.filter[k]} <span className="chip-n">{num(lang, rows.filter((b) => inFilter(b.status, k)).length)}</span></button>)}
    </div>
    <div className="grid">{list.length ? list.map((b) => <BookingCard key={b.id} b={b} onAct={act} onReject={setRej} />)
      : <div className="empty"><span className="empty-ic"><Icon name="search" size={28} /></span><h3>{p.emptyFilterT}</h3><p>{p.emptyFilter}</p></div>}</div>
    {rej && <RejectDialog b={rej} onClose={() => setRej(null)} onDone={(note) => act(rej.id, "reject", note)} />}
  </>;
}

function Billing({ b, reload }: { b: any; reload: () => void }) {
  const { t, lang } = useI18n(); const p = t.portal;
  const [busy, setBusy] = useState(false);
  async function renew() {
    setBusy(true); const r = await fetch("/api/hospital/billing", { method: "POST" }); const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return toast(apiError(t, lang, j.error), "err"); toast(p.renewed); reload(); // page wording, not the API message
  }
  if (!b) return <div className="skel tall" />;
  const key = accountKey(b)!;
  const pays = b.payments ?? [];
  return <div className="bill">
    <section className={"card bill-status st-" + key} aria-labelledby="bill-h">
      <span className="bill-ic"><Icon name={key === "ACTIVE" ? "check" : key === "PENDING" ? "clock" : "alert"} size={26} /></span>
      <p className="eyebrow">{p.subscription}</p>
      <h3 id="bill-h">{p.st[key]}</h3>
      {b.approved && b.expiresAt && <p className="bill-date">{b.status === "ACTIVE" ? p.activeUntilL : p.expiredOn}: <b>{date(lang, b.expiresAt)}</b></p>}
      {key === "PENDING" && <div className="banner info">{p.awaitingText}</div>}
      {key === "SUSPENDED" && <div className="banner warn">{p.suspendedText}</div>}
      {b.approved && b.canRenew && <button className="btn em" disabled={busy} aria-busy={busy || undefined} onClick={renew}>{busy ? p.renewing : p.renew}</button>}
      {b.approved && !b.canRenew && <p className="hint">{fill(p.renewOpens, { n: num(lang, b.renewWindowDays) })}</p>}
      <p className="hint">{p.inactiveText}</p>
    </section>
    <section className="card bill-history" aria-labelledby="pay-h">
      <h3 id="pay-h">{p.payHistory}</h3>
      {pays.length ? <div className="table-wrap"><table>
        <thead><tr>{["date", "purpose", "amount", "status", "ref"].map((c) => <th key={c} scope="col">{p.cols[c]}</th>)}</tr></thead>
        <tbody>{pays.map((x: any) => <tr key={x.id}><td>{date(lang, x.createdAt)}</td><td>{p.purpose[x.purpose] || x.purpose}</td><td>{money(lang, x.amount)}</td>
          <td>{p.payStatus[x.status] || x.status}</td><td className="mono">{x.trxId && !/^demo/i.test(x.trxId) ? x.trxId : "—"}</td></tr>)}</tbody>
      </table></div> : <p className="muted">{p.noPayments}</p>}
    </section>
  </div>;
}

export default function Portal() {
  const { t, lang } = useI18n(); const p = t.portal;
  const [b, setB] = useState<any>(null), [h, setH] = useState<any>(null), [tab, setTab] = useState("bookings");
  const [rows, setRows] = useState<any[] | null>(null), [rowsFailed, setRowsFailed] = useState(false), [filter, setFilter] = useState("all");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reload = () => fetch("/api/hospital/billing").then((r) => r.json()).then(setB).catch(() => {});
  const loadProfile = () => fetch("/api/hospital/profile").then((r) => r.ok ? r.json() : null).then(setH).catch(() => {});
  const loadRows = () => { setRowsFailed(false); return fetch("/api/hospital/bookings").then((r) => r.json()).then((j) => setRows(Array.isArray(j) ? j : [])).catch(() => setRowsFailed(true)); };
  useEffect(() => { reload(); loadProfile(); loadRows(); }, []);
  useEffect(() => { if (b && b.status !== "ACTIVE") setTab("billing"); }, [b?.status]);
  // Deep links such as /portal#accommodations (used by the account menu). Display only: every tab still checks permissions on the server.
  useEffect(() => {
    const ids = TABS.map((x) => x[0]);
    const sync = () => { const hh = window.location.hash.slice(1); if (ids.includes(hh)) setTab(hh); };
    sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync);
  }, []);
  const go = (id: string, focus = false) => { setTab(id); history.replaceState(null, "", "#" + id); if (focus) tabRefs.current[id]?.focus(); };
  function onTabKey(e: React.KeyboardEvent, i: number) {
    const k = e.key, last = TABS.length - 1;
    const j = k === "ArrowRight" || k === "ArrowDown" ? (i === last ? 0 : i + 1) : k === "ArrowLeft" || k === "ArrowUp" ? (i === 0 ? last : i - 1) : k === "Home" ? 0 : k === "End" ? last : -1;
    if (j < 0) return; e.preventDefault(); go(TABS[j][0], true);
  }

  const key = accountKey(b), locked = !!b && b.status !== "ACTIVE";
  const daysLeft = b?.status === "ACTIVE" && b.expiresAt ? Math.max(0, Math.ceil((new Date(b.expiresAt).getTime() - Date.now()) / 86_400_000)) : null;
  const count = (fl: string) => (rows || []).filter((x) => inFilter(x.status, fl)).length;
  const kpis: [string, IconName, string][] = [["new", "clock", p.kNew], ["confirmed", "check", p.kConfirmed], ["closed", "inbox", p.kDone]];
  const lockedText = key === "PENDING" ? p.lockedPending : p.lockedRenew;
  const bannerText = key === "PENDING" ? p.bannerPending : key === "SUSPENDED" ? p.bannerSuspended : p.bannerExpired;
  const cur = TABS.find((x) => x[0] === tab) || TABS[0];

  return <div className="hp">
    <section className="hp-hero" aria-labelledby="hp-title">
      <div className="hero-bg" aria-hidden><span className="orb o1" /><span className="orb o2" /><span className="grid-lines" /></div>
      <div className="hp-hero-main rise d1">
        <span className="hp-logo">{h?.photoUrl ? <img src={h.photoUrl} alt="" width={64} height={64} /> : <Icon name="hospital" size={30} />}</span>
        <div className="hp-id">
          <p className="eyebrow light">{p.title}</p>
          <h1 id="hp-title">{h?.name || p.title}</h1>
          {key && <p className="hp-meta">
            <span className={"hp-st st-" + key}><Icon name={key === "ACTIVE" ? "check" : key === "PENDING" ? "clock" : "alert"} size={15} />{p.st[key]}</span>
            {key === "ACTIVE" && b.expiresAt && <span>{fill(p.activeUntil, { d: date(lang, b.expiresAt) })}</span>}
            {daysLeft != null && <span>{fill(p.daysLeft, { n: num(lang, daysLeft) })}</span>}
          </p>}
        </div>
        {key === "ACTIVE" && h?.id && <Link href={`/hospitals/${h.id}`} className="btn glass sm hp-public">{p.viewPublic}<Icon name="arrow" size={16} /></Link>}
      </div>
      <ul className="hp-kpis rise d2">{kpis.map(([fl, ic, label]) => <li key={fl}>
        <button type="button" className={"hp-kpi k-" + fl} onClick={() => { setFilter(fl); go("bookings"); }}>
          <span className="hp-kpi-ic"><Icon name={ic} size={18} /></span><span className="hp-kpi-n">{rows ? num(lang, count(fl)) : "–"}</span><span className="hp-kpi-l">{label}</span>
        </button></li>)}</ul>
    </section>

    {locked && <div className="banner warn hp-banner" role="status"><Icon name="alert" size={18} /><span>{bannerText}</span>
      {tab !== "billing" && <button type="button" className="btn ghost sm" onClick={() => go("billing", true)}>{p.openBilling}</button>}</div>}

    <div className="hp-body">
      <div className="hp-rail" role="tablist" aria-label={p.sections}>
        {TABS.map(([id, ic], i) => <button key={id} ref={(el) => { tabRefs.current[id] = el; }} id={"pt-" + id} role="tab" type="button"
          aria-selected={tab === id} aria-controls="hp-panel" tabIndex={tab === id ? 0 : -1} className={"hp-tab" + (tab === id ? " on" : "")}
          onClick={() => go(id)} onKeyDown={(e) => onTabKey(e, i)}>
          <span className="hp-tab-ic"><Icon name={ic} size={18} /></span><span className="hp-tab-l">{p.tabs[id]}</span>
          {id === "bookings" && rows && count("new") > 0 && <span className="hp-tab-n" aria-label={fill("{n} " + p.kNew, { n: num(lang, count("new")) })}>{num(lang, count("new"))}</span>}
        </button>)}
      </div>
      <section className="hp-panel" id="hp-panel" role="tabpanel" aria-labelledby={"pt-" + tab} key={tab}>
        <header className="hp-panel-head"><span className={"hp-panel-ic tone-" + tab}><Icon name={cur[1]} size={22} /></span>
          <div><h2>{p.tabs[tab]}</h2><p className="sub">{p.tabSub[tab]}</p></div></header>
        {tab === "bookings" && <Bookings rows={rows} failed={rowsFailed} reload={loadRows} filter={filter} setFilter={setFilter} />}
        {tab === "doctors" && <CrudPanel resource="doctors" fields={DOC} locked={locked} lockedText={lockedText} summary={docSum} />}
        {tab === "accommodations" && <CrudPanel resource="accommodations" fields={ACC} locked={locked} lockedText={lockedText} summary={accSum} />}
        {tab === "blood" && <Blood locked={locked} />}
        {tab === "tests" && <CrudPanel resource="tests" fields={TST} locked={locked} lockedText={lockedText} summary={tstSum} />}
        {tab === "ambulance" && <ProviderPortal embedded />}
        {tab === "profile" && <CrudPanel resource="profile" fields={PRO} single onSaved={loadProfile} />}
        {tab === "billing" && <Billing b={b} reload={reload} />}
      </section>
    </div>
  </div>;
}
