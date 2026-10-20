import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needUser, HttpError } from "@/lib/guard";
import { startPayment } from "@/lib/payments";
import { audit } from "@/lib/audit";
import { isActive } from "@/lib/subscription";

// POST { action }  patient: pay | cancel   provider: accept | reject | complete | cancel
export const POST = handle(async (req, { params }) => {
  const u = await needUser(); const { action } = await req.json().catch(() => ({}));
  const b = await db.ambulanceBooking.findUnique({ where: { id: params.id }, include: { provider: true } });
  const isPatient = !!b && u.role === "PATIENT" && b.patientId === u.id, isProv = !!b && (u.role === "AMBULANCE" || u.role === "HOSPITAL") && b.provider.userId === u.id;
  if (!b || (!isPatient && !isProv)) throw new HttpError(404, "Booking not found"); // never reveal other people's bookings
  const move = async (from: string[], to: string, extra: any = {}) => {
    const r = await db.ambulanceBooking.updateMany({ where: { id: b.id, status: { in: from as any } }, data: { status: to as any, ...extra } }); // guarded: no invalid transitions
    if (!r.count) throw new HttpError(409, "This booking can't be changed from its current status");
    await audit({ actorId: u.id, action: "AMBULANCE_" + to, entity: "AmbulanceBooking", entityId: b.id });
    return NextResponse.json({ ok: true });
  };
  if (action === "accept" && isProv) {
    if (u.role === "HOSPITAL") { const h = await db.hospital.findUnique({ where: { userId: u.id } }); if (!h || !isActive(h)) throw new HttpError(402, "Renew your subscription to accept bookings"); }
    return move(["PENDING"], "ACCEPTED");
  }
  if (action === "reject" && isProv) return move(["PENDING"], "REJECTED");
  if (action === "complete" && isProv) return move(["CONFIRMED"], "COMPLETED");
  if (action === "cancel") return move(["PENDING", "ACCEPTED", "CONFIRMED"], "CANCELLED", b.status === "CONFIRMED" ? { refundPending: true } : {});
  if (action === "pay" && isPatient) {
    if (b.status !== "ACCEPTED") throw new HttpError(409, "The provider has not accepted this request yet");
    const paid = await db.payment.findFirst({ where: { ambulanceBookingId: b.id, status: { in: ["COMPLETED", "PENDING_VERIFICATION"] } } });
    if (paid) throw new HttpError(409, "The confirmation fee is already paid or awaiting verification"); // no duplicate fee
    await db.ambulanceBooking.update({
      where: { id: b.id },
      data: { status: "CONFIRMED" },
    });
    const out = await startPayment({
      purpose: "AMBULANCE_FEE",
      amount: b.feeBdt,
      userId: u.id,
      ambulanceBookingId: b.id,
    });
    return NextResponse.json({
      url: out.url,
      status: "CONFIRMED",
      demo: true,
      message: "Demo confirmation only. No payment was taken.",
    });
  }
  throw new HttpError(400, "Action not allowed");
});

