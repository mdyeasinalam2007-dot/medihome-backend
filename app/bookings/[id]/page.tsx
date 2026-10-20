import { notFound, redirect } from "next/navigation";
import { me } from "@/lib/auth";
import { db } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/constants";
import BookingActions from "@/components/BookingActions";
export const dynamic = "force-dynamic";
export default async function BookingPage({ params, searchParams }: { params: { id: string }; searchParams: { payment?: string } }) {
  const u = await me(); if (!u) redirect("/login");
  const b = await db.booking.findUnique({ where: { id: params.id }, include: { hospital: { select: { name: true, userId: true, phone: true, address: true } }, payments: true } });
  if (!b || (b.patientId !== u.id && b.hospital.userId !== u.id)) notFound();
  const mine = b.patientId === u.id, paid = b.payments.find((p) => p.status === "COMPLETED");
  return <div style={{ maxWidth: 560 }}><h1>Booking <em>{b.id.slice(-8).toUpperCase()}</em></h1>
    {searchParams.payment === "success" && <div className="banner ok">Payment verified. Thank you!</div>}
    {b.payments.some((p) => p.status === "PENDING_VERIFICATION") && <div className="banner info">Your payment reference was received and is awaiting verification. The booking updates once it is verified.</div>}
    {searchParams.payment && searchParams.payment !== "success" && <div className="banner warn">Payment was not completed ({searchParams.payment}). You have not been charged for this booking.</div>}
    <div className="card" style={{ marginTop: 12 }}><div className="row" style={{ marginTop: 0 }}><h3>{b.itemName}</h3><span className="badge">{STATUS_LABEL[b.status]}</span></div>
      <p>{b.hospital.name}{mine ? ` · ${b.hospital.address}` : ""}</p>
      <div className="sum">
        {b.startDate && <div><span>Date</span>{b.startDate.toISOString().slice(0, 10)} {b.apptTime || ""}</div>}{b.days && <div><span>Days</span>{b.days}</div>}{b.units && <div><span>Units</span>{b.units}</div>}
        {b.baseAmount > 0 && <div><span>Hospital charge (estimate, paid to hospital)</span>৳{b.baseAmount}</div>}{b.extraAmount > 0 && <div><span>Additional charges</span>৳{b.extraAmount}</div>}{b.depositAmount > 0 && <div><span>Refundable deposit</span>৳{b.depositAmount}</div>}
        <div><span>MediHome service fee</span>৳{b.feeBdt}</div><div><span>Fee status</span>{paid ? "Paid" : "Unpaid"}</div>{paid?.trxId && <div><span>Transaction</span>{paid.trxId}</div>}
        <div><span>Created</span>{b.createdAt.toLocaleString()}</div></div>
      {b.hospitalNote && <p style={{ marginTop: 8 }}>Hospital note: {b.hospitalNote}</p>}
      {b.status === "REFUND_PENDING" && <p className="banner info" style={{ marginTop: 10 }}>Your BDT {b.feeBdt} service fee will be refunded. Refunds are processed manually.</p>}
      {mine && <BookingActions id={b.id} status={b.status} />}</div></div>;
}
