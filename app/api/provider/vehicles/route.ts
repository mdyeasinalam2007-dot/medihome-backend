import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needProvider, HttpError } from "@/lib/guard";
import { parse } from "@/lib/resources";
import { audit } from "@/lib/audit";
const DEF = { type: "s", regNo: "s?", area: "s", baseFare: "n", perKm: "n?", notes: "s?", available: "b?" };

export const GET = handle(async () => { const { p } = await needProvider(); return NextResponse.json(await db.ambulance.findMany({ where: { providerId: p.id }, orderBy: { createdAt: "desc" } })); });
export const POST = handle(async (req) => {
  const { u, p } = await needProvider(true);
  const row = await db.ambulance.create({ data: { ...parse(DEF, await req.json().catch(() => ({}))), providerId: p.id } });
  await audit({ actorId: u.id, action: "AMBULANCE_CREATE", entity: "Ambulance", entityId: row.id });
  return NextResponse.json(row, { status: 201 });
});
export const PATCH = handle(async (req) => { // toggle availability
  const { p } = await needProvider(true); const id = new URL(req.url).searchParams.get("id") || "";
  const v = await db.ambulance.findFirst({ where: { id, providerId: p.id } }); if (!v) throw new HttpError(404, "Not found");
  await db.ambulance.update({ where: { id }, data: { available: !v.available } }); return NextResponse.json({ ok: true });
});
export const DELETE = handle(async (req) => {
  const { p } = await needProvider(true); const id = new URL(req.url).searchParams.get("id") || "";
  try { const r = await db.ambulance.deleteMany({ where: { id, providerId: p.id } }); return NextResponse.json({ deleted: r.count }); }
  catch { throw new HttpError(409, "This ambulance has bookings. Mark it unavailable instead."); }
});
