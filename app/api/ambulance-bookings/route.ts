import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needUser, HttpError, limit } from "@/lib/guard";
import { AMB_FEE } from "@/lib/pricing";
import { ambVisible } from "@/lib/queries";

export const POST = handle(async (req) => {
  const u = await needUser("PATIENT"); limit("amb:" + u.id, 8, 60_000);
  const b = await req.json().catch(() => ({}));
  const v = await db.ambulance.findFirst({ where: { id: String(b.ambulanceId), available: true, ...ambVisible() } });
  if (!v) throw new HttpError(404, "This ambulance is not available");
  const pickup = String(b.pickup || "").trim().slice(0, 300), destination = String(b.destination || "").trim().slice(0, 300), contact = String(b.contact || "").trim().slice(0, 20);
  const when = new Date(String(b.requestedAt || ""));
  if (!pickup || !destination || contact.replace(/\D/g, "").length < 8) throw new HttpError(400, "Pickup, destination and a valid contact number are required");
  if (isNaN(+when) || +when < Date.now() - 5 * 60_000) throw new HttpError(400, "Choose a valid future time");
  const row = await db.ambulanceBooking.create({ data: { patientId: u.id, providerId: v.providerId, ambulanceId: v.id, type: v.type, pickup, destination, contact, requestedAt: when,
    fareText: `৳${v.baseFare}${v.perKm ? ` + ৳${v.perKm}/km` : ""}`, feeBdt: AMB_FEE() } }); // no fee yet: it is charged only after the provider accepts
  return NextResponse.json({ id: row.id }, { status: 201 });
});
