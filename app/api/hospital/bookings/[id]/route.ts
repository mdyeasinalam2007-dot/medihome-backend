import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needHospital, HttpError, assertHospitalActive } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { holdsBed, moveBooking, releaseBed, rule, takeBlood } from "@/lib/bookingFlow";

// PATCH { action: "confirm" | "reject" | "complete", note? }  - always scoped to the caller's hospital.
// Every change is a guarded transition inside one transaction, so a booking can't be changed twice
// and inventory can never go negative. Demo mode: rejecting never triggers a refund (nothing was paid).
export const PATCH = handle(async (req, { params }) => {
  const { h, u } = await needHospital(false); const { action, note } = await req.json().catch(() => ({}));
  const r = rule("hospital", String(action));
  if (!r) throw new HttpError(400, "Unknown action");
  const b = await db.booking.findFirst({ where: { id: params.id, hospitalId: h.id } });
  if (!b) throw new HttpError(404, "Booking not found");
  if (action === "confirm") assertHospitalActive(h); // pending / suspended / expired hospitals can't accept bookings
  if (!r.from.includes(b.status as any)) throw new HttpError(409, action === "confirm" ? "Only new requests can be confirmed" : "This booking can't be changed from its current status");
  const hospitalNote = note ? String(note).slice(0, 500) : undefined;

  await db.$transaction(async (tx) => {
    await moveBooking(tx, { id: b.id, hospitalId: h.id }, r.from, { status: r.to, hospitalNote });
    if (action === "confirm" && b.type === "BLOOD") await takeBlood(tx, h.id, b.itemRef!, b.units || 0); // fulfilment: stock reduced only now
    if (action === "reject" && holdsBed(b)) await releaseBed(tx, b.itemRef!);
  });
  await audit({ actorId: u.id, hospitalId: h.id, action: "BOOKING_" + String(action).toUpperCase(), entity: "Booking", entityId: b.id });
  return NextResponse.json({ ok: true, status: r.to });
});
