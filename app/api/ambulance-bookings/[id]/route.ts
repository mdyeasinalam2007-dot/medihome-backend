import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needUser, HttpError, assertHospitalActive } from "@/lib/guard";
import { audit } from "@/lib/audit";

// POST { action }  patient: pay | cancel   provider: accept | reject | complete | cancel
// DEMO MODE: "pay" confirms the accepted request without collecting any fee, and nothing is ever refunded.
export const POST = handle(async (req, { params }) => {
  const u = await needUser(); const { action } = await req.json().catch(() => ({}));
  const b = await db.ambulanceBooking.findUnique({ where: { id: params.id }, include: { provider: true } });
  const isPatient = !!b && u.role === "PATIENT" && b.patientId === u.id, isProv = !!b && (u.role === "AMBULANCE" || u.role === "HOSPITAL") && b.provider.userId === u.id;
  if (!b || (!isPatient && !isProv)) throw new HttpError(404, "Booking not found"); // never reveal other people's bookings
  const move = async (from: string[], to: string, extra: any = {}) => {
    const r = await db.ambulanceBooking.updateMany({ where: { id: b.id, status: { in: from as any } }, data: { status: to as any, ...extra } }); // guarded: no invalid transitions
    if (!r.count) throw new HttpError(409, "This booking can't be changed from its current status");
    await audit({ actorId: u.id, action: "AMBULANCE_" + to, entity: "AmbulanceBooking", entityId: b.id });
    return NextResponse.json({ ok: true, status: to, ...(to === "CONFIRMED" ? { demo: true, message: "Confirmed. Demo mode: no fee was collected." } : {}) });
  };
  if (action === "accept" && isProv) {
    if (u.role === "HOSPITAL") { const h = await db.hospital.findUnique({ where: { userId: u.id } }); if (!h) throw new HttpError(403, "No hospital linked to this account"); assertHospitalActive(h); }
    return move(["PENDING"], "ACCEPTED");
  }
  if (action === "reject" && isProv) return move(["PENDING"], "REJECTED");
  if (action === "complete" && isProv) return move(["CONFIRMED"], "COMPLETED");
  if (action === "cancel") return move(["PENDING", "ACCEPTED", "CONFIRMED"], "CANCELLED");
  if (action === "pay" && isPatient) {
    if (b.status !== "ACCEPTED") throw new HttpError(409, "The provider has not accepted this request yet");
    return move(["ACCEPTED"], "CONFIRMED");
  }
  throw new HttpError(400, "Action not allowed");
});
