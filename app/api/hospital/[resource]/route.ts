import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needHospital, HttpError } from "@/lib/guard";
import { RES, PROFILE_FIELDS, parse } from "@/lib/resources";
import { BLOOD_GROUPS } from "@/lib/constants";
import { effectiveStatus, extendExpiry, isApproved, canRenew, RENEW_WINDOW_DAYS } from "@/lib/subscription";
import { REG_FEE, MONTHLY_FEE } from "@/lib/pricing";
import { audit } from "@/lib/audit";

const model = (r: string) => (db as any)[RES[r].model];

export const GET = handle(async (_req, { params }) => {
  const r = params.resource; const { h } = await needHospital(false);
  if (RES[r]) return NextResponse.json(await model(r).findMany({ where: { hospitalId: h.id }, orderBy: { id: "desc" } }));
  if (r === "profile") return NextResponse.json(h);
  if (r === "blood") return NextResponse.json(await db.bloodStock.findMany({ where: { hospitalId: h.id } }));
  if (r === "billing") {
    const payments = await db.payment.findMany({ where: { hospitalId: h.id, purpose: { in: ["REGISTRATION", "SUBSCRIPTION"] } }, orderBy: { createdAt: "desc" }, take: 30 });
    return NextResponse.json({ status: effectiveStatus(h), expiresAt: h.subExpiresAt, regPaid: h.regPaid, regFee: REG_FEE(), monthlyFee: MONTHLY_FEE(), mode: "demo",
      approved: isApproved(h), canRenew: canRenew(h), renewWindowDays: RENEW_WINDOW_DAYS, payments });
  }
  throw new HttpError(404, "Unknown resource");
});

export const POST = handle(async (req, { params }) => {
  const r = params.resource, b = await req.json().catch(() => ({}));
  if (r === "billing") { // DEMO renewal. It can never approve a hospital: only an administrator can (see /owner).
    const { u, h } = await needHospital(false);
    if (h.subStatus === "SUSPENDED") throw new HttpError(403, "Account suspended. Please contact support.");
    if (!isApproved(h)) throw new HttpError(403, "Your hospital is awaiting approval by a MediHome administrator. Billing opens after approval.");
    if (!canRenew(h)) throw new HttpError(409, `Your subscription is already active until ${h.subExpiresAt!.toISOString().slice(0, 10)}. Renewal opens ${RENEW_WINDOW_DAYS} days before it ends.`);
    const now = new Date(), next = extendExpiry(h.subExpiresAt, now);
    // Guarded update: matches only while still approved and inside the renewal window, so a double click can't stack months.
    const x = await db.hospital.updateMany({
      where: { id: h.id, subStatus: "ACTIVE", OR: [{ subExpiresAt: null }, { subExpiresAt: { lte: new Date(now.getTime() + RENEW_WINDOW_DAYS * 86_400_000) } }] },
      data: { subExpiresAt: next, regPaid: true },
    });
    if (!x.count) throw new HttpError(409, "Your subscription was just renewed.");
    await audit({ actorId: u.id, hospitalId: h.id, action: "SUBSCRIPTION_RENEWED_DEMO", entity: "Hospital", entityId: h.id, meta: { until: next.toISOString() } });
    return NextResponse.json({ ok: true, demo: true, subscriptionStatus: "ACTIVE", expiresAt: next, message: "Demo mode: subscription renewed for 30 days. No money was collected." });
  }
  if (!RES[r]) throw new HttpError(404, "Unknown resource");
  const { h, u } = await needHospital(true);
  const row = await model(r).create({ data: { ...parse(RES[r].f, b), hospitalId: h.id } });
  await audit({ actorId: u.id, hospitalId: h.id, action: "CREATE", entity: r, entityId: row.id });
  return NextResponse.json(row, { status: 201 });
});

export const PUT = handle(async (req, { params }) => {
  const r = params.resource, b = await req.json().catch(() => ({})), id = new URL(req.url).searchParams.get("id") || "";
  if (r === "profile") { // profile stays editable even if the subscription lapsed
    const { h, u } = await needHospital(false);
    await db.hospital.update({ where: { id: h.id }, data: parse(PROFILE_FIELDS, b) });
    await audit({ actorId: u.id, hospitalId: h.id, action: "PROFILE_UPDATE", entity: "Hospital", entityId: h.id });
    return NextResponse.json({ ok: true });
  }
  const { h, u } = await needHospital(true);
  if (r === "blood") {
    for (const g of Object.keys(b)) if (!BLOOD_GROUPS.includes(g)) throw new HttpError(400, "Invalid blood group");
    const before = await db.bloodStock.findMany({ where: { hospitalId: h.id } });
    for (const [group, v] of Object.entries(b)) {
      const units = Math.max(0, Math.min(100000, Math.floor(Number(v) || 0)));
      await db.bloodStock.upsert({ where: { hospitalId_group: { hospitalId: h.id, group } }, update: { units }, create: { hospitalId: h.id, group, units } });
    }
    await audit({ actorId: u.id, hospitalId: h.id, action: "BLOOD_STOCK_UPDATE", entity: "BloodStock", meta: { before: Object.fromEntries(before.map((x) => [x.group, x.units])), after: b } });
    return NextResponse.json({ ok: true });
  }
  if (!RES[r]) throw new HttpError(404, "Unknown resource");
  const x = await model(r).updateMany({ where: { id, hospitalId: h.id }, data: parse(RES[r].f, b) }); // scoped to own hospital
  if (!x.count) throw new HttpError(404, "Not found");
  await audit({ actorId: u.id, hospitalId: h.id, action: "UPDATE", entity: r, entityId: id });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req, { params }) => {
  const r = params.resource, id = new URL(req.url).searchParams.get("id") || "";
  if (!RES[r]) throw new HttpError(404, "Unknown resource");
  const { h, u } = await needHospital(true);
  const x = await model(r).deleteMany({ where: { id, hospitalId: h.id } });
  await audit({ actorId: u.id, hospitalId: h.id, action: "DELETE", entity: r, entityId: id });
  return NextResponse.json({ deleted: x.count });
});

