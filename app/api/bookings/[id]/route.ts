import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needUser, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { doctorSlotWhere, holdsBed, initialStatus, moveBooking, releaseBed, rule, serializable, takeBed } from "@/lib/bookingFlow";

// POST { action: "pay" | "cancel" } on the patient's own booking.
// DEMO MODE: "pay" never collects money. It only moves an old AWAITING_PAYMENT booking into the normal flow.
export const POST = handle(async (req, { params }) => {
  const u = await needUser("PATIENT"); const { action } = await req.json().catch(() => ({}));
  const b = await db.booking.findFirst({ where: { id: params.id, patientId: u.id } });
  if (!b) throw new HttpError(404, "Booking not found");

  if (action === "pay") {
    if (b.status !== "AWAITING_PAYMENT") throw new HttpError(409, "This booking is not awaiting payment");
    const to = initialStatus(b.type);
    await serializable(async (tx) => {
      if (b.type === "DOCTOR" && b.itemRef && b.startDate) { // the slot may have been taken while this booking sat unpaid
        const clash = await tx.booking.findFirst({ where: { ...doctorSlotWhere(b.itemRef, b.startDate, b.apptTime), id: { not: b.id } } });
        if (clash) throw new HttpError(409, "That slot is no longer available. Please book another time.");
      }
      if (b.type === "BED") await takeBed(tx, b.itemRef!, b.hospitalId);
      await moveBooking(tx, { id: b.id, patientId: u.id }, ["AWAITING_PAYMENT"], { status: to, ...(b.type === "BED" ? { units: 1 } : {}) });
    });
    await audit({ actorId: u.id, hospitalId: b.hospitalId, action: "BOOKING_SUBMITTED_DEMO", entity: "Booking", entityId: b.id });
    return NextResponse.json({ status: to, demo: true, message: "Demo mode: no payment was collected." });
  }

  if (action === "cancel") {
    await db.$transaction(async (tx) => {
      await moveBooking(tx, { id: b.id, patientId: u.id }, rule("patient", "cancel")!.from, { status: "CANCELLED" });
      if (holdsBed(b)) await releaseBed(tx, b.itemRef!); // give the held bed back (exactly once: the status guard above runs first)
    });
    await audit({ actorId: u.id, hospitalId: b.hospitalId, action: "BOOKING_CANCELLED_BY_PATIENT", entity: "Booking", entityId: b.id });
    return NextResponse.json({ ok: true });
  }
  throw new HttpError(400, "Unknown action");
});
