/* eslint-disable @next/next/no-img-element -- hospital photos are stored as small data URLs */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getHospital } from "@/lib/queries";
import { FEE } from "@/lib/pricing";
import Empty from "@/components/Empty";
import Icon, { type IconName } from "@/components/ui/Icon";
import { Unavailable } from "@/components/listing/Listing";
import { DoctorCard, BedCard, TestCard, BloodCard, AmbulanceCard } from "@/components/listing/Cards";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";
import { has } from "@/lib/format";

export const dynamic = "force-dynamic";

// getHospital() only finds approved, active hospitals (activeWhere): pending or suspended ones are a 404, unchanged.
export default async function Hospital({ params }: { params: { id: string } }) {
  const lang = getLang(), t = getDictFor(lang), th = t.hospital;
  let h: any = null, failed = false;
  try { h = await getHospital(params.id); } catch (err: any) { console.error("Failed to load hospital:", err?.message || err); failed = true; }
  if (failed) return <Unavailable t={t} />;
  if (!h) notFound();

  const ref = { id: h.id, name: h.name, location: h.location }; // lets the booking dialog show the hospital name
  const withH = (rows: any[]) => (rows || []).map((r) => ({ ...r, hospitalId: h.id, hospital: ref }));
  const doctors = withH(h.doctors), beds = withH(h.accommodations), tests = withH(h.tests), blood = withH(h.blood);
  const vehicles = h.user?.ambulanceProvider?.vehicles || [];
  const facilities = String(h.facilities || "").split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
  const phoneLike = /^\+?[\d\s-]{3,20}$/.test(String(h.emergency || "").trim());
  const fee = FEE();

  const sections: [string, string, IconName, number, React.ReactNode][] = [
    ["doctors", th.doctors, "doctor", doctors.length, doctors.map((d) => <DoctorCard key={d.id} d={d} t={t} lang={lang} fee={fee} showHospital={false} />)],
    ["beds", th.beds, "bed", beds.length, beds.map((a) => <BedCard key={a.id} a={a} t={t} lang={lang} fee={fee} showHospital={false} />)],
    ["tests", th.tests, "test", tests.length, tests.map((x) => <TestCard key={x.id} x={x} t={t} lang={lang} fee={fee} showHospital={false} />)],
    ["blood", th.blood, "blood", blood.length, blood.map((s) => <BloodCard key={s.group} s={s} t={t} lang={lang} fee={fee} showHospital={false} hospitalName={h.name} />)],
    ["ambulance", th.ambulance, "ambulance", vehicles.length, vehicles.map((v: any) => <AmbulanceCard key={v.id} v={v} t={t} lang={lang} providerName={h.name} />)],
  ];
  const shown = sections.filter((s) => s[3] > 0);

  return <>
    <Link href="/hospitals" className="back-link"><Icon name="arrow" size={16} className="flip" />{th.back}</Link>
    <header className="hosp-head card">
      {h.photoUrl ? <img className="hosp-cover" src={h.photoUrl} alt="" /> : <span className="hosp-cover ph" aria-hidden><Icon name="hospital" size={40} /></span>}
      <div className="hosp-info">
        <span className="badge ok"><Icon name="shield" size={14} />{th.approved}</span>
        <h1>{h.name}</h1>
        {(has(h.address) || has(h.location)) && <p className="meta"><Icon name="hospital" size={16} />{[h.address, h.location].filter(has).join(", ")}</p>}
        {has(h.description) && <p className="desc">{h.description}</p>}
        {has(h.emergency) && (phoneLike
          ? <a className="btn sos sm" href={`tel:${String(h.emergency).replace(/[\s-]/g, "")}`}><Icon name="phone" size={16} />{th.emergency}: {h.emergency}</a>
          : <p className="meta"><Icon name="phone" size={16} />{th.emergency}: {h.emergency}</p>)}
      </div>
    </header>

    {facilities.length > 0 && <section className="section-sm" aria-labelledby="fac"><h2 id="fac">{th.facilities}</h2><ul className="tags lg">{facilities.map((f: string) => <li key={f}>{f}</li>)}</ul></section>}

    {shown.length > 1 && <nav className="chip-row on-page" aria-label={th.onPage}>{shown.map(([id, label, ic, n]) => <a key={id} href={`#${id}`} className="chip"><Icon name={ic} size={16} />{label} ({n})</a>)}</nav>}

    {shown.length ? shown.map(([id, label, ic, , cards]) => <section key={id} id={id} className="section-sm" aria-labelledby={id + "-h"}>
      <h2 id={id + "-h"} className="sec-title"><Icon name={ic} />{label}</h2>
      {id === "blood" && has(h.bloodNote) && <p className="banner info">{th.bloodNote}: {h.bloodNote}</p>}
      <div className="grid">{cards}</div>
    </section>) : <Empty icon="hospital" title={h.name} text={th.nothing} />}
  </>;
}
