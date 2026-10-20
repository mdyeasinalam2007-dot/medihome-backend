import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needHospital } from "@/lib/guard";
import { maskPhone } from "@/lib/mask";

export const GET = handle(async () => {
  const { h } = await needHospital(false);
  const rows = await db.booking.findMany({ where: { hospitalId: h.id, status: { not: "AWAITING_PAYMENT" } }, orderBy: { createdAt: "desc" }, take: 200,
    include: { patient: { select: { name: true, phone: true } }, payments: { select: { status: true, trxId: true, providerPaymentId: true } } } });
  const audits = await db.auditLog.findMany({ where: { hospitalId: h.id, entity: "Booking" }, orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json(rows.map((b) => ({ ...b, patient: { name: b.patient.name, phone: maskPhone(b.patient.phone) }, history: audits.filter((a) => a.entityId === b.id).map((a) => ({ action: a.action, at: a.createdAt })) })));
});
