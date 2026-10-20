import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needProvider } from "@/lib/guard";
import { maskPhone } from "@/lib/mask";

export const GET = handle(async () => {
  const { p } = await needProvider();
  const rows = await db.ambulanceBooking.findMany({ where: { providerId: p.id }, orderBy: { createdAt: "desc" }, take: 200, include: { patient: { select: { name: true } }, payments: { select: { status: true, trxId: true } } } });
  // Patient contact is revealed only after the provider has accepted the request.
  return NextResponse.json(rows.map((b) => ({ ...b, contact: ["ACCEPTED", "CONFIRMED", "COMPLETED"].includes(b.status) ? b.contact : maskPhone(b.contact) })));
});
