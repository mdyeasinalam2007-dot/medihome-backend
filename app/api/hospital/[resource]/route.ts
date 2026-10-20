import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needHospital, HttpError } from "@/lib/guard";
import { RES, PROFILE_FIELDS, parse } from "@/lib/resources";
import { BLOOD_GROUPS } from "@/lib/constants";
import { effectiveStatus, extendExpiry } from "@/lib/subscription";
import { REG_FEE, MONTHLY_FEE } from "@/lib/pricing";
import { startPayment } from "@/lib/payments";
import { paymentMode } from "@/lib/bkash";
import { maskPhone } from "@/lib/mask";
import { audit } from "@/lib/audit";

const model = (r: string) => (db as any)[RES[r].model];

export const GET = handle(async (_req, { params }) => {
  const r = params.resource; const { h } = await needHospital(false);
  if (RES[r]) return NextResponse.json(await model(r).findMany({ where: { hospitalId: h.id }, orderBy: { id: "desc" } }));
  if (r === "profile") return NextResponse.json(h);
  if (r === "blood") return NextResponse.json(await db.bloodStock.findMany({ where: { hospitalId: h.id } }));
  if (r === "billing") {
    const payments = await db.payment.findMany({ where: { hospitalId: h.id, purpose: { in: ["REGISTRATION", "SUBSCRIPTION"] } }, orderBy: { createdAt: "desc" }, take: 30 });
    return NextResponse.json({ status: effectiveStatus(h), expiresAt: h.subExpiresAt, regPaid: h.regPaid, regFee: REG_FEE(), monthlyFee: MONTHLY_FEE(), mode: paymentMode(),
      destination: maskPhone(process.env.MEDIHOME_PAYMENT_DESTINATION), payments });
  }
  throw new HttpError(404, "Unknown resource");
});

export const POST = handle(async (req, { params }) => {
  const r = params.resource, b = await req.json().catch(() => ({}));
  if (r === "billing") { // allowed even when inactive: this is how an account is (re)activated
    const { u, h } = await needHospital(false);
    if (h.subStatus === "SUSPENDED") throw new HttpError(403, "Account suspended. Please contact support.");
    const purpose = h.regPaid ? "SUBSCRIPTION" : "REGISTRATION";
    const updated = await db.hospital.update({
      where: { id: h.id },
      data: {
        subStatus: "ACTIVE",
        subExpiresAt: extendExpiry(h.subExpiresAt),
        regPaid: true,
      },
    });
    const out = await startPayment({
      purpose,
      amount: purpose === "REGISTRATION" ? REG_FEE() : MONTHLY_FEE(),
      userId: u.id,
      hospitalId: h.id,
    });
    return NextResponse.json({
      url: out.url,
      demo: true,
      subscriptionStatus: updated.subStatus,
      expiresAt: updated.subExpiresAt,
      message: "Demo subscription activated. No money was transferred.",
    });
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

