import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needHospital, HttpError } from "@/lib/guard";
import { isActive } from "@/lib/subscription";
import { audit } from "@/lib/audit";

// PATCH { action: "confirm" | "reject" | "complete", note? }  - always scoped to the caller's hospital
export const PATCH = handle(async (req, { params }) => {
  const { h, u } = await needHospital(false); const { action, note } = await req.json();
  const b = await db.booking.findFirst({ where: { id: params.id, hospitalId: h.id } });
  if (!b) throw new HttpError(404, "Booking not found");
  const hospitalNote = note ? String(note).slice(0, 500) : undefined;

  if (action === "confirm") {
    if (!isActive(h)) throw new HttpError(402, "Renew your subscription to accept bookings");
    if (b.status !== "PAID") throw new HttpError(409, "Only paid requests can be confirmed");
    await db.$transaction(async (tx) => {
      if (b.type === "BLOOD") { // fulfilment step: stock is reduced only now
        const r = await tx.bloodStock.updateMany({ where: { hospitalId: h.id, group: b.itemRef!, units: { gte: b.units! } }, data: { units: { decrement: b.units! } } });
        if (!r.count) throw new HttpError(409, "Not enough units in stock");
      }
      await tx.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED", hospitalNote } });
    });
  } else if (action === "reject") {
    if (!["PAID", "CONFIRMED"].includes(b.status)) throw new HttpError(409, "This booking cannot be rejected now");
    await db.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: b.id }, data: { status: "REFUND_PENDING", hospitalNote } });
      if (b.type === "BED") await tx.accommodation.update({ where: { id: b.itemRef! }, data: { available: { increment: 1 } } });
    });
  } else if (action === "complete") {
    if (b.status !== "CONFIRMED") throw new HttpError(409, "Only confirmed bookings can be completed");
    await db.booking.update({ where: { id: b.id }, data: { status: "COMPLETED", hospitalNote } });
  } else throw new HttpError(400, "Unknown action");
  await audit({ actorId: u.id, hospitalId: h.id, action: "BOOKING_" + String(action).toUpperCase(), entity: "Booking", entityId: b.id });
  return NextResponse.json({ ok: true });
});
