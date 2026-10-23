/* eslint-disable @next/next/no-img-element -- photos are stored as small data URLs, which next/image cannot optimise */
import Link from "next/link";
import Icon from "../ui/Icon";
import BookDialog from "../BookDialog";
import AmbulanceDialog from "../AmbulanceDialog";
import { catLabel } from "@/lib/constants";
import type { Dict, Lang } from "@/lib/i18n/dictionaries";
import { money, num, date, fill, has } from "@/lib/format";

// One definition per card type, used by the listing pages AND the hospital detail page.
// Rule: hide fields that are empty or 0 (0 means "not filled in"); never show "0 yrs" or "৳0".
type C = { t: Dict; lang: Lang; fee: number; showHospital?: boolean };
const initial = (name?: string) => (name || "?").replace(/^dr\.?\s*/i, "").trim().charAt(0).toUpperCase() || "?";
const split = (s?: string) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

function HospitalLine({ h, show }: { h?: { id: string; name: string; location?: string }; show?: boolean }) {
  if (!show || !h) return null;
  return <p className="meta"><Icon name="hospital" size={16} /><Link href={`/hospitals/${h.id}`} className="link">{h.name}</Link>{h.location ? <span className="muted"> · {h.location}</span> : null}</p>;
}
function Price({ t, lang, value, suffix }: { t: Dict; lang: Lang; value: number; suffix?: string }) {
  return has(value) ? <p className="price"><b>{money(lang, value)}</b>{suffix && <span>{suffix}</span>}</p> : <p className="price muted-price">{t.list.priceNotListed}</p>;
}

export function DoctorCard({ d, t, lang, fee, showHospital = true }: C & { d: any }) {
  const schedule = [d.visitingDays, d.visitingHours].filter(has).join(" · ");
  return <article className="card item">
    <div className="item-head">
      {d.photoUrl ? <img className="av" src={d.photoUrl} alt="" /> : <span className="av" aria-hidden>{initial(d.name)}</span>}
      <div><h3>{d.name}</h3>{has(d.specialty) && <p className="spec">{d.specialty}</p>}</div>
    </div>
    {has(d.qualification) && <p className="meta"><Icon name="shield" size={16} />{d.qualification}</p>}
    {has(d.experience) && <p className="meta"><Icon name="check" size={16} />{fill(t.doctors.years, { n: num(lang, d.experience) })}</p>}
    {schedule && <p className="meta"><Icon name="calendar" size={16} />{fill(t.doctors.visiting, { v: schedule })}</p>}
    <HospitalLine h={d.hospital} show={showHospital} />
    <div className="item-foot">
      <Price t={t} lang={lang} value={d.feeBdt} />
      <BookDialog type="DOCTOR" label={t.doctors.book} hospitalId={d.hospital?.id || d.hospitalId} itemId={d.id} title={d.name} hospital={d.hospital?.name || ""}
        fee={fee} price={d.feeBdt} slots={split(d.slots)} schedule={schedule || undefined} />
    </div>
  </article>;
}

export function BedCard({ a, t, lang, fee, showHospital = true }: C & { a: any }) {
  const name = t.cats[a.category] || catLabel(a.category), open = a.available > 0;
  const tags = [a.ac === true ? t.beds.ac : a.ac === false ? t.beds.nonAc : "", a.sharing === "SHARED" ? t.beds.shared : t.beds.private,
    a.attachedBath ? t.beds.bath : "", (t.beds.levels as Record<string, string>)[a.facilityLevel] || ""].filter(Boolean);
  const pct = a.total > 0 ? Math.max(0, Math.min(100, Math.round((a.available / a.total) * 100))) : 0;
  return <article className="card item">
    <div className="item-head between"><h3>{name}</h3>
      <span className={"badge " + (open ? "ok" : "bad")}>{open ? fill(t.beds.available, { a: num(lang, a.available), t: num(lang, a.total) }) : t.beds.full}</span></div>
    {a.total > 0 && <div className="meter" role="img" aria-label={open ? fill(t.beds.available, { a: num(lang, a.available), t: num(lang, a.total) }) : t.beds.full}><span style={{ width: pct + "%" }} /></div>}
    {(has(a.name) || has(a.unit)) && <p className="meta"><Icon name="bed" size={16} />{[a.name, a.unit].filter(has).join(" · ")}</p>}
    <HospitalLine h={a.hospital} show={showHospital} />
    {tags.length > 0 && <ul className="tags">{tags.map((x) => <li key={x}>{x}</li>)}</ul>}
    {has(a.equipment) && <p className="small">{a.equipment}</p>}
    {has(a.notes) && <p className="small">{fill(t.beds.note, { v: a.notes })}</p>}
    {has(a.additionalCharge) && <p className="small">{fill(t.beds.additional, { v: money(lang, a.additionalCharge) })}</p>}
    {has(a.deposit) && <p className="small">{fill(t.beds.deposit, { v: money(lang, a.deposit) })}</p>}
    {a.updatedAt && <p className="stamp">{fill(t.list.updated, { d: date(lang, a.updatedAt) })}</p>}
    <div className="item-foot">
      <Price t={t} lang={lang} value={a.pricePerDay} suffix={t.beds.perDay} />
      <BookDialog type="BED" label={t.beds.request} hospitalId={a.hospital?.id || a.hospitalId} itemId={a.id} title={name} hospital={a.hospital?.name || ""}
        fee={fee} disabled={!open} bed={{ pricePerDay: a.pricePerDay, additional: a.additionalCharge || 0, deposit: a.deposit || 0 }} />
    </div>
  </article>;
}

export function TestCard({ x, t, lang, fee, showHospital = true }: C & { x: any }) {
  const col = split(x.collection || "LAB");
  return <article className="card item">
    <div className="item-head between"><h3>{x.name}</h3>{col.includes("HOME") && <span className="badge ok">{t.tests.home}</span>}</div>
    {has(x.category) && <p className="spec">{x.category}</p>}
    <HospitalLine h={x.hospital} show={showHospital} />
    {has(x.preparation) && <p className="small">{fill(t.tests.prep, { v: x.preparation })}</p>}
    {has(x.reportTime) && <p className="small">{fill(t.tests.report, { v: x.reportTime })}</p>}
    <div className="item-foot">
      <Price t={t} lang={lang} value={x.priceBdt} />
      <BookDialog type="TEST" label={t.tests.book} hospitalId={x.hospital?.id || x.hospitalId} itemId={x.id} title={x.name} hospital={x.hospital?.name || ""}
        fee={fee} price={x.priceBdt} collection={col} />
    </div>
  </article>;
}

export function BloodCard({ s, t, lang, fee, showHospital = true, hospitalName }: C & { s: any; hospitalName?: string }) {
  return <article className="card item">
    <div className="item-head between"><span className="blood-group">{s.group}</span><span className="badge bad">{fill(t.blood.units, { n: num(lang, s.units) })}</span></div>
    <HospitalLine h={s.hospital ? { id: s.hospitalId, name: s.hospital.name, location: s.hospital.location } : undefined} show={showHospital} />
    {showHospital && has(s.hospital?.bloodNote) && <p className="small">{fill(t.blood.requirements, { v: s.hospital.bloodNote })}</p>}
    {s.updatedAt && <p className="stamp">{fill(t.list.updated, { d: date(lang, s.updatedAt) })}</p>}
    <div className="item-foot"><span />
      <BookDialog type="BLOOD" label={t.blood.request} hospitalId={s.hospitalId} itemId={s.group} title={`${t.blood.filterLabel} ${s.group}`}
        hospital={s.hospital?.name || hospitalName || ""} fee={fee} maxUnits={s.units} />
    </div>
  </article>;
}

export function ambulanceFare(t: Dict, lang: Lang, v: { baseFare: number; perKm?: number }) {
  return money(lang, v.baseFare) + (has(v.perKm) ? " " + fill(t.ambulance.perKm, { v: money(lang, v.perKm!) }) : "");
}
export function AmbulanceCard({ v, t, lang, providerName }: Omit<C, "fee"> & { v: any; providerName?: string }) {
  const provider = providerName || v.provider?.name || "", area = v.area || v.provider?.area || "", fare = ambulanceFare(t, lang, v);
  return <article className="card item">
    <div className="item-head between"><h3>{v.type}</h3><span className="badge ok">{t.ambulance.available}</span></div>
    {(provider || area) && <p className="meta"><Icon name="ambulance" size={16} />{[provider, area].filter(Boolean).join(" · ")}</p>}
    {has(v.notes) && <p className="small">{v.notes}</p>}
    <div className="item-foot">
      <p className="price"><b>{fill(t.ambulance.fare, { f: fare })}</b><span className="fare-note">{t.ambulance.paidToProvider}</span></p>
      <AmbulanceDialog id={v.id} title={v.type} provider={provider} fare={fare} />
    </div>
  </article>;
}

export function HospitalCard({ h, t, lang }: { h: any; t: Dict; lang: Lang }) {
  const c = h._count || {};
  const counts = [[c.doctors, t.hospitals.doctors], [c.accommodations, t.hospitals.beds], [c.tests, t.hospitals.tests]].filter(([n]) => has(n)) as [number, string][];
  return <Link href={`/hospitals/${h.id}`} className="card item hosp">
    {h.photoUrl ? <img className="hosp-photo" src={h.photoUrl} alt="" /> : <span className="hosp-photo ph" aria-hidden><Icon name="hospital" size={32} /></span>}
    <div className="item-head between"><h3>{h.name}</h3><span className="badge ok"><Icon name="shield" size={14} />{t.hospital.approved}</span></div>
    {(has(h.location) || has(h.address)) && <p className="meta"><Icon name="hospital" size={16} />{[h.address, h.location].filter(has).join(", ")}</p>}
    {counts.length > 0 && <ul className="tags">{counts.map(([n, l]) => <li key={l}>{fill(l, { n: num(lang, n) })}</li>)}</ul>}
    <span className="item-go">{t.hospitals.view}<Icon name="arrow" size={16} /></span>
  </Link>;
}
