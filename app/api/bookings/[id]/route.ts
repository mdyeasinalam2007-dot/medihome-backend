import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needUser, HttpError } from "@/lib/guard";
import { startPayment } from "@/lib/payments";
import { audit } from "@/lib/audit";

// POST { action: "pay" | "cancel" } on the patient's own booking
export const POST = handle(async (req, { params }) => {
  const u = await needUser("PATIENT"); const { action } = await req.json();
  const b = await db.booking.findFirst({ where: { id: params.id, patientId: u.id } });
  if (!b) throw new HttpError(404, "Booking not found");
  if (action === "pay") {
    if (b.status !== "AWAITING_PAYMENT") throw new HttpError(409, "This booking is not awaiting payment");
    if (await db.payment.findFirst({ where: { bookingId: b.id, status: "PENDING_VERIFICATION" } })) throw new HttpError(409, "Your payment is awaiting verification");
    if (b.type === "BED") { const a = await db.accommodation.findUnique({ where: { id: b.itemRef! } }); if (!a || a.available < 1) throw new HttpError(409, "No units available any more"); }
    await db.booking.update({
      where: { id: b.id },
      data: { status: "CONFIRMED" },
    });
    const { url } = await startPayment({
      purpose: "BOOKING",
      amount: b.feeBdt,
      userId: u.id,
      hospitalId: b.hospitalId,
      bookingId: b.id,
    });
    return NextResponse.json({
      url,
      status: "CONFIRMED",
      demo: true,
      message: "Booking confirmed. No payment was taken.",
    });
  }
  if (action === "cancel") {
    if (b.status === "AWAITING_PAYMENT") await db.booking.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
    else if (b.status === "PAID" || b.status === "CONFIRMED") {
      await db.booking.update({
        where: { id: b.id },
        data: { status: "CANCELLED" },
      });
    } else throw new HttpError(409, "This booking can no longer be cancelled");
    await audit({ actorId: u.id, hospitalId: b.hospitalId, action: "BOOKING_CANCELLED_BY_PATIENT", entity: "Booking", entityId: b.id });
    return NextResponse.json({ ok: true });
  }
  throw new HttpError(400, "Unknown action");
});

