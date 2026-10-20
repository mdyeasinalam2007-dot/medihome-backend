import { redirect } from "next/navigation";
import Link from "next/link";
import { me } from "@/lib/auth";
import { db } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/constants";
import Empty from "@/components/Empty";
import ProfileForm from "@/components/ProfileForm";
import AmbulanceActions from "@/components/AmbulanceActions";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const u = await me(); if (!u) redirect("/login"); if (u.role === "HOSPITAL") redirect("/portal"); if (u.role === "AMBULANCE") redirect("/provider");
  const amb = await db.ambulanceBooking.findMany({ where: { patientId: u.id }, orderBy: { createdAt: "desc" }, include: { provider: { select: { name: true } }, payments: true } });
  const [user, rows] = await Promise.all([db.user.findUnique({ where: { id: u.id } }),
    db.booking.findMany({ where: { patientId: u.id }, orderBy: { createdAt: "desc" }, include: { hospital: { select: { name: true } }, payments: true } })]);
  return <><h1>My <em>dashboard</em></h1>
    <h2 style={{ margin: "18px 0 8px" }}>Booking history</h2>
    <div className="grid">{rows.length ? rows.map((b) => <Link href={`/bookings/${b.id}`} className="card" key={b.id}>
      <div className="row" style={{ marginTop: 0 }}><h3>{b.itemName}</h3><span className="badge">{STATUS_LABEL[b.status]}</span></div>
      <p>{b.hospital.name} · {b.type}</p><p>{b.createdAt.toLocaleString()}{b.startDate ? ` · for ${b.startDate.toISOString().slice(0, 10)} ${b.apptTime || ""}` : ""}</p>
      <p>Service fee ৳{b.feeBdt}: {b.payments.some((p) => p.status === "COMPLETED") ? "Paid" : "Unpaid"}</p></Link>)
      : <Empty icon="📋" title="No bookings yet" text="Your appointments, bed requests, blood requests and tests will appear here." />}</div>
    <h2 style={{ margin: "24px 0 8px" }}>Ambulance requests</h2>
    <div className="grid">{amb.length ? amb.map((b) => <div className="card" key={b.id}><div className="row" style={{ marginTop: 0 }}><h3>{b.type}</h3><span className="badge">{b.status === "ACCEPTED" ? "Accepted - pay fee to confirm" : b.status}</span></div>
      <p>{b.provider.name} · ID {b.id.slice(-8)}</p><p>From: {b.pickup}</p><p>To: {b.destination}</p><p>When: {b.requestedAt.toLocaleString()}</p><p>Fare: {b.fareText} (paid directly to provider)</p>
      <p>Confirmation fee ৳{b.feeBdt}: {b.payments.find((p) => p.status === "COMPLETED") ? "Paid · " + b.payments.find((p) => p.status === "COMPLETED")!.trxId : "Not paid"}{b.refundPending ? " · refund pending" : ""}</p>
      <AmbulanceActions id={b.id} status={b.status} who="patient" fee={b.feeBdt} /></div>) : <Empty icon="🚑" title="No ambulance requests" text="Requests you send will appear here." />}</div>
    <h2 style={{ margin: "24px 0 8px" }}>Payment history</h2>
    <div className="card" style={{ overflowX: "auto" }}>{rows.some((b) => b.payments.length) ? <table><tbody>{rows.flatMap((b) => b.payments.map((p) => <tr key={p.id}><td>{p.createdAt.toLocaleDateString()}</td><td>{b.itemName}</td><td>৳{p.amount}</td><td>{p.status}</td><td>{p.trxId || ""}</td></tr>))}</tbody></table> : <p>No payments yet.</p>}</div>
    <div style={{ marginTop: 24 }}><ProfileForm name={user?.name || ""} phone={user?.phone || ""} /></div></>;
}
