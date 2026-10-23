import { redirect } from "next/navigation";
import Link from "next/link";
import { me } from "@/lib/auth";
import { loginFor } from "@/lib/safeNext";
import { db } from "@/lib/db";
import Empty from "@/components/Empty";
import ProfileForm from "@/components/ProfileForm";
import Icon, { type IconName } from "@/components/ui/Icon";
import { PageHead, Unavailable } from "@/components/listing/Listing";
import { PatientBookingCard, PatientAmbulanceCard } from "@/components/patient/Cards";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";
import { groupBookings, ambulanceActive } from "@/lib/status";
import { num, money, date, fill, todayBD } from "@/lib/format";

export const dynamic = "force-dynamic";

// Patient dashboard. Access unchanged: patients only (hospital / ambulance accounts go to their portals),
// and every query is filtered by the signed-in patient's id.
export default async function Dashboard() {
  const u = await me(); if (!u) redirect(loginFor("/dashboard")); if (u.role === "HOSPITAL") redirect("/portal"); if (u.role === "AMBULANCE") redirect("/provider");
  const lang = getLang(), t = getDictFor(lang), d = t.dash;

  let user: any = null, rows: any[] = [], amb: any[] = [], failed = false;
  try {
    [user, rows, amb] = await Promise.all([
      db.user.findUnique({ where: { id: u.id }, select: { name: true, phone: true, passwordHash: true } }), // only used as a yes/no below
      db.booking.findMany({ where: { patientId: u.id }, orderBy: { createdAt: "desc" }, include: { hospital: { select: { id: true, name: true } }, payments: true } }),
      db.ambulanceBooking.findMany({ where: { patientId: u.id }, orderBy: { createdAt: "desc" }, include: { provider: { select: { name: true } } } }),
    ]);
  } catch (err: any) { console.error("Failed to load dashboard:", err?.message || err); failed = true; }
  if (failed) return <><PageHead icon="dashboard" title={d.title} /><Unavailable t={t} /></>;

  const g = groupBookings(rows, todayBD());
  const activeAmb = amb.filter((x) => ambulanceActive(x.status)).length;
  const payments = rows.flatMap((b) => b.payments.map((p: any) => ({ ...p, item: b.itemName })));
  const tiles: [string, IconName, number, string][] = [["upcoming", "calendar", g.upcoming.length, d.tUpcoming], ["requests", "clock", g.requests.length, d.tWaiting], ["ambulance", "ambulance", activeAmb, d.tAmbulance]];
  const sections: [string, string, any[], IconName, string, string][] = [
    ["upcoming", d.upcoming, g.upcoming, "calendar", d.emptyUpcomingT, d.emptyUpcoming],
    ["requests", d.requests, g.requests, "clock", d.emptyRequestsT, d.emptyRequests],
    ["past", d.past, g.past, "check", d.emptyPastT, d.emptyPast],
  ];

  return <>
    <PageHead icon="dashboard" title={user?.name ? fill(d.hello, { name: user.name }) : d.title} sub={d.sub} />
    <ul className="tiles" aria-label={d.title}>{tiles.map(([id, ic, n, label]) =>
      <li key={id}><a href={`#${id}`} className="tile"><span className="tile-ic"><Icon name={ic} /></span><span className="tile-n">{num(lang, n)}</span><span className="tile-l">{label}</span></a></li>)}
    </ul>
    <nav className="chip-row on-page" aria-label={d.jump}>
      {sections.map(([id, label, list]) => <a key={id} className="chip" href={`#${id}`}>{label} ({num(lang, list.length)})</a>)}
      <a className="chip" href="#ambulance">{d.ambulance} ({num(lang, amb.length)})</a>
      <a className="chip" href="#profile">{d.profile}</a>
    </nav>

    {sections.map(([id, label, list, ic, et, ex]) => <section key={id} id={id} className="section-sm" aria-labelledby={id + "-h"}>
      <h2 id={id + "-h"} className="sec-title"><Icon name={ic} />{label}</h2>
      <div className="grid">{list.length ? list.map((b) => <PatientBookingCard key={b.id} b={b} t={t} lang={lang} />)
        : <div className="empty"><span className="empty-ic"><Icon name={ic} size={28} /></span><h3>{et}</h3><p>{ex}</p>
            {id !== "past" && <p className="empty-act"><Link className="btn sm" href="/doctors">{d.findDoctor}</Link></p>}</div>}</div>
    </section>)}

    <section id="ambulance" className="section-sm" aria-labelledby="amb-h">
      <h2 id="amb-h" className="sec-title"><Icon name="ambulance" />{d.ambulance}</h2>
      <div className="grid">{amb.length ? amb.map((b) => <PatientAmbulanceCard key={b.id} b={b} t={t} lang={lang} />)
        : <div className="empty"><span className="empty-ic"><Icon name="ambulance" size={28} /></span><h3>{d.emptyAmbT}</h3><p>{d.emptyAmb}</p>
            <p className="empty-act"><Link className="btn sm" href="/ambulance">{d.requestAmb}</Link></p></div>}</div>
    </section>

    {payments.length > 0 && <section className="section-sm" aria-labelledby="pay-h">
      <h2 id="pay-h" className="sec-title"><Icon name="check" />{d.payments}</h2>
      <div className="card table-wrap"><table><tbody>{payments.map((p) => <tr key={p.id}><td>{date(lang, p.createdAt)}</td><td>{p.item}</td><td>{money(lang, p.amount)}</td><td>{p.status}</td></tr>)}</tbody></table></div>
    </section>}

    <section id="profile" className="section-sm" aria-labelledby="profile-h">
      <h2 id="profile-h" className="sec-title"><Icon name="user" />{d.profile}</h2>
      <ProfileForm name={user?.name || ""} phone={user?.phone || ""} hasPassword={!!user?.passwordHash} />
    </section>
  </>;
}
