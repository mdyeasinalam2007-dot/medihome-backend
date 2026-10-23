import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { me } from "@/lib/auth";
import { loginFor } from "@/lib/safeNext";
import { db } from "@/lib/db";
import BookingActions from "@/components/BookingActions";
import StatusBadge from "@/components/StatusBadge";
import CopyId from "@/components/CopyId";
import Icon from "@/components/ui/Icon";
import { Unavailable } from "@/components/listing/Listing";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";
import { bookingTone, timeline } from "@/lib/status";
import { money, dateTime, day, plural, has } from "@/lib/format";

export const dynamic = "force-dynamic";

// Access is unchanged: signed-out visitors go to /login; only the patient who made the booking or the
// hospital it belongs to can see it. Anyone else gets a 404, which does not reveal that the booking exists.
export default async function BookingPage({ params }: { params: { id: string } }) {
  const u = await me(); if (!u) redirect(loginFor("/bookings/" + params.id));
  const lang = getLang(), t = getDictFor(lang), k = t.bk;
  let b: any = null;
  try {
    b = await db.booking.findUnique({ where: { id: params.id }, include: { hospital: { select: { id: true, name: true, userId: true, address: true } }, payments: true } });
  } catch (err: any) { console.error("Failed to load booking:", err?.message || err); return <Unavailable t={t} />; }
  if (!b || (b.patientId !== u.id && b.hospital.userId !== u.id)) notFound();

  const mine = b.patientId === u.id;
  const paid = b.payments.find((p: any) => p.status === "COMPLETED");
  const steps = timeline(b.type, b.status);
  const explain = b.status === "AWAITING_PAYMENT" ? k.notSubmittedText : ["REQUESTED", "PAID"].includes(b.status) ? k.requestedText : b.status === "CONFIRMED" ? k.confirmedText
    : b.status === "COMPLETED" ? k.completedText : b.status === "CANCELLED" ? k.cancelledText : k.declinedText;
  const rows: [string, React.ReactNode][] = [[k.type, t.types[b.type] || b.type], [k.hospital, b.hospital.name]];
  if (mine && has(b.hospital.address)) rows.push([k.address, b.hospital.address]);
  if (b.startDate) rows.push([k.date, day(lang, b.startDate)]);
  if (b.apptTime) rows.push([k.time, b.apptTime]);
  if (has(b.days)) rows.push([k.stay, plural(lang, b.days, t.plural.dayOne, t.plural.dayMany)]);
  if (b.type === "BLOOD" && has(b.units)) rows.push([k.units, plural(lang, b.units, t.plural.unitOne, t.plural.unitMany)]);
  if (b.baseAmount > 0) rows.push([k.hospitalCharge, money(lang, b.baseAmount)]);
  if (b.extraAmount > 0) rows.push([k.additional, money(lang, b.extraAmount)]);
  if (b.depositAmount > 0) rows.push([k.deposit, money(lang, b.depositAmount)]);
  if (paid?.trxId) rows.push([k.transaction, paid.trxId]);
  rows.push([k.created, dateTime(lang, b.createdAt)]);

  return <div className="narrow">
    <Link href={mine ? "/dashboard" : "/portal"} className="back-link"><Icon name="arrow" size={16} className="flip" />{mine ? k.backDash : k.backPortal}</Link>
    <header className="card booking-head">
      <div className="item-head between"><span className="type-chip"><Icon name="calendar" size={16} />{t.types[b.type] || b.type}</span>
        <StatusBadge tone={bookingTone(b.status)} label={t.status[b.status] || b.status} /></div>
      <h1>{b.itemName}</h1>
      <p className="meta"><span className="muted">{k.title}</span> <CopyId id={b.id} /></p>
      <p className={"banner " + (["REJECTED", "REFUND_PENDING", "CANCELLED", "REFUNDED"].includes(b.status) ? "warn" : b.status === "CONFIRMED" || b.status === "COMPLETED" ? "ok" : "info")}>{explain}</p>
      {!mine && <p className="banner info">{k.hospitalView}</p>}
      {b.payments.some((p: any) => p.status === "PENDING_VERIFICATION") && <p className="banner info">{k.pendingVerification}</p>}
    </header>

    <section className="section-sm" aria-labelledby="prog-h">
      <h2 id="prog-h">{k.progress}</h2>
      <ol className="timeline">{steps.map((s) => <li key={s.key} className={s.state} aria-current={s.state === "now" ? "step" : undefined}>
        <span className="dot" aria-hidden>{s.state === "done" || s.state === "now" ? <Icon name="check" size={16} /> : s.state === "stop" ? <Icon name="close" size={16} /> : null}</span>{k.steps[s.key]}</li>)}</ol>
    </section>

    <section className="section-sm" aria-labelledby="det-h">
      <h2 id="det-h">{k.details}</h2>
      <dl className="card kv lg">{rows.map(([label, v]) => <div key={label}><dt>{label}</dt><dd>{v}</dd></div>)}</dl>
      {has(b.note) && <p className="card note"><b>{k.note}:</b> {b.note}</p>}
      {has(b.hospitalNote) && <p className="card note"><b>{k.hospitalNote}:</b> {b.hospitalNote}</p>}
    </section>

    {mine && <BookingActions id={b.id} status={b.status} />}
  </div>;
}
