import Link from "next/link";
import Icon, { type IconName } from "../ui/Icon";
import StatusBadge from "../StatusBadge";
import BookingActions from "../BookingActions";
import AmbulanceActions from "../AmbulanceActions";
import type { Dict, Lang } from "@/lib/i18n/dictionaries";
import { bookingTone, ambTone } from "@/lib/status";
import { date, dateTime, day, fill, plural, has } from "@/lib/format";

const TYPE_ICON: Record<string, IconName> = { DOCTOR: "doctor", BED: "bed", BLOOD: "blood", TEST: "test" };

// One patient booking on the dashboard. Data comes from the patient's own rows only (filtered by patientId on the server).
export function PatientBookingCard({ b, t, lang }: { b: any; t: Dict; lang: Lang }) {
  const when = b.startDate ? day(lang, b.startDate) + (b.apptTime ? " · " + b.apptTime : "") : null;
  const extra = [b.type === "BED" && has(b.days) ? plural(lang, b.days, t.plural.dayOne, t.plural.dayMany) : "",
    b.type === "BLOOD" && has(b.units) ? plural(lang, b.units, t.plural.unitOne, t.plural.unitMany) : ""].filter(Boolean);
  return <article className="card item booking-card">
    <div className="item-head between">
      <span className="type-chip"><Icon name={TYPE_ICON[b.type] || "calendar"} size={16} />{t.types[b.type] || b.type}</span>
      <StatusBadge tone={bookingTone(b.status)} label={t.status[b.status] || b.status} />
    </div>
    <h3>{b.itemName}</h3>
    <p className="meta"><Icon name="hospital" size={16} />{b.hospital?.name}</p>
    {when && <p className="meta"><Icon name="calendar" size={16} /><b className="when">{when}</b></p>}
    {extra.length > 0 && <p className="meta"><Icon name="check" size={16} />{extra.join(" · ")}</p>}
    <p className="stamp">{t.dash.id} <span className="mono">{b.id.slice(-8).toUpperCase()}</span> · {fill(t.dash.bookedOn, { d: date(lang, b.createdAt) })}</p>
    <div className="item-foot">
      <Link className="btn ghost sm" href={`/bookings/${b.id}`}>{t.dash.view}<Icon name="arrow" size={16} /></Link>
      <BookingActions id={b.id} status={b.status} compact />
    </div>
  </article>;
}

// One ambulance request on the patient dashboard.
export function PatientAmbulanceCard({ b, t, lang }: { b: any; t: Dict; lang: Lang }) {
  return <article className="card item booking-card">
    <div className="item-head between">
      <span className="type-chip"><Icon name="ambulance" size={16} />{b.type}</span>
      <StatusBadge tone={ambTone(b.status)} label={t.ambStatus[b.status] || b.status} />
    </div>
    <h3>{b.provider?.name}</h3>
    <dl className="kv">
      <div><dt>{t.dash.from}</dt><dd>{b.pickup}</dd></div>
      <div><dt>{t.dash.to}</dt><dd>{b.destination}</dd></div>
      <div><dt>{t.dash.when}</dt><dd><b>{dateTime(lang, b.requestedAt)}</b></dd></div>
      <div><dt>{t.dash.fare}</dt><dd>{b.fareText} <span className="muted">({t.dash.farePaid})</span></dd></div>
    </dl>
    <p className="stamp">{t.dash.id} <span className="mono">{b.id.slice(-8).toUpperCase()}</span> · {fill(t.dash.bookedOn, { d: date(lang, b.createdAt) })}</p>
    <div className="item-foot"><span /><AmbulanceActions id={b.id} status={b.status} who="patient" /></div>
  </article>;
}
