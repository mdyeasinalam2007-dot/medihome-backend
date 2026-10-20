import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needUser, HttpError, limit } from "@/lib/guard";
import { activeWhere } from "@/lib/subscription";
import { FEE, bedEstimate } from "@/lib/pricing";

import { catLabel } from "@/lib/constants";

export const GET = handle(async () => {
  const u = await needUser("PATIENT");
  return NextResponse.json(await db.booking.findMany({ where: { patientId: u.id }, orderBy: { createdAt: "desc" }, include: { hospital: { select: { name: true } } } }));
});

const HOLD = ["REQUESTED", "AWAITING_PAYMENT", "PAID", "CONFIRMED"];
export const POST = handle(async (req) => {
  const u = await needUser("PATIENT"); limit("book:" + u.id, 10, 60_000);
  const b = await req.json().catch(() => ({}));
  const h = await db.hospital.findFirst({ where: { id: String(b.hospitalId), ...activeWhere() } });
  if (!h) throw new HttpError(404, "This hospital is not accepting bookings right now");
  const date = String(b.date || ""), today = new Date().toISOString().slice(0, 10);
  const data: any = { patientId: u.id, hospitalId: h.id, type: b.type, feeBdt: FEE(), note: b.note ? String(b.note).slice(0, 500) : null };

  if (b.type === "DOCTOR") {
    const d = await db.doctor.findFirst({ where: { id: String(b.itemId), hospitalId: h.id, published: true } });
    if (!d) throw new HttpError(404, "Doctor not available");
    const slots = d.slots.split(",").map((s) => s.trim()).filter(Boolean), time = String(b.time || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) throw new HttpError(400, "Choose a valid future date");
    if (slots.length && !slots.includes(time)) throw new HttpError(400, "Choose an available time slot");
    Object.assign(data, { itemName: `${d.name} (${d.specialty})`, itemRef: d.id, baseAmount: d.feeBdt, startDate: new Date(date + "T00:00:00Z"), apptTime: time || null });
  } else if (b.type === "TEST") {
    const t = await db.diagnosticTest.findFirst({ where: { id: String(b.itemId), hospitalId: h.id, published: true } });
    if (!t) throw new HttpError(404, "Test not available");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) throw new HttpError(400, "Choose a valid future date");
    const col = t.collection.split(",").includes(String(b.collection)) ? String(b.collection) : "LAB";
    Object.assign(data, { itemName: `${t.name} (${col === "HOME" ? "home collection" : "lab visit"})`, itemRef: t.id, baseAmount: t.priceBdt, startDate: new Date(date + "T00:00:00Z") });
  } else if (b.type === "BED") {
    const a = await db.accommodation.findFirst({ where: { id: String(b.itemId), hospitalId: h.id, published: true } });
    const days = Math.floor(Number(b.days));
    if (!a || a.available < 1) throw new HttpError(409, "No units available");
    if (!(days >= 1 && days <= 60)) throw new HttpError(400, "Duration must be 1-60 days");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) throw new HttpError(400, "Choose a valid admission date");
    const e = bedEstimate(a.pricePerDay, days, a.additionalCharge, a.deposit); // price always computed on the server
    Object.assign(data, { itemName: `${catLabel(a.category)}${a.name ? " - " + a.name : ""}`, itemRef: a.id, days, startDate: new Date(date + "T00:00:00Z"), baseAmount: e.accommodation, extraAmount: e.additional, depositAmount: e.deposit });
  } else if (b.type === "BLOOD") {
    const units = Math.floor(Number(b.units)), s = await db.bloodStock.findUnique({ where: { hospitalId_group: { hospitalId: h.id, group: String(b.group) } } });
    if (!s || !(units >= 1 && units <= 10) || s.units < units) throw new HttpError(409, "Requested units are not listed as available");
    Object.assign(data, { itemName: `Blood ${s.group}`, itemRef: s.group, units });
  } else throw new HttpError(400, "Invalid booking type");

  let booking;
  try {
    booking = await db.$transaction(async (tx) => {
      if (data.type === "DOCTOR") { // no double booking of the same doctor/date/time (unpaid holds expire after 30 min)
        const clash = await tx.booking.findFirst({ where: { type: "DOCTOR", itemRef: data.itemRef, startDate: data.startDate, apptTime: data.apptTime, OR: [{ status: { in: ["PAID", "CONFIRMED", "REQUESTED"] } }, { status: "AWAITING_PAYMENT", createdAt: { gt: new Date(Date.now() - 30 * 60_000) } }] } });
        if (clash) throw new HttpError(409, "That slot was just taken. Please choose another.");
      }
      return tx.booking.create({ data: { ...data, status: "CONFIRMED" } });
    }, { isolationLevel: "Serializable" });
  } catch (e: any) { if (e.code === "P2034") throw new HttpError(409, "Slot was just taken, please retry"); throw e; }

  return NextResponse.json({ bookingId: booking.id, status: booking.status, message: "Booking confirmed" });
});

