import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, HttpError } from "@/lib/guard";
import { needOwner } from "@/lib/owner";
import { effectiveStatus, extendExpiry } from "@/lib/subscription";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET: every hospital with its approval status (pending first). Admin only.
export const GET = handle(async (req) => {
  needOwner(req);
  const rows = await db.hospital.findMany({
    orderBy: { createdAt: "desc" }, take: 500,
    select: { id: true, name: true, contactPerson: true, phone: true, address: true, location: true, license: true, subStatus: true, subExpiresAt: true, createdAt: true, user: { select: { email: true } } },
  });
  const out = rows.map((h) => ({ ...h, email: h.user?.email || null, user: undefined, status: effectiveStatus(h) }));
  out.sort((a, b) => Number(b.subStatus !== "ACTIVE" && b.subStatus !== "SUSPENDED") - Number(a.subStatus !== "ACTIVE" && a.subStatus !== "SUSPENDED"));
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
});

// POST { id, action: "approve" | "suspend" }. Admin only. Guarded so a status can't flip twice.
export const POST = handle(async (req) => {
  needOwner(req);
  const { id, action } = await req.json().catch(() => ({}));
  const h = await db.hospital.findUnique({ where: { id: String(id || "") } });
  if (!h) throw new HttpError(404, "Hospital not found");
  if (action === "approve") {
    const now = new Date(), expires = h.subExpiresAt && h.subExpiresAt > now ? h.subExpiresAt : extendExpiry(null, now); // first 30 days (demo: no payment)
    const x = await db.hospital.updateMany({ where: { id: h.id, subStatus: { not: "ACTIVE" } }, data: { subStatus: "ACTIVE", subExpiresAt: expires, regPaid: true } });
    if (!x.count) throw new HttpError(409, "This hospital is already approved");
    await audit({ hospitalId: h.id, action: "HOSPITAL_APPROVED", entity: "Hospital", entityId: h.id, meta: { by: "owner", from: h.subStatus } });
    return NextResponse.json({ ok: true, status: "ACTIVE", expiresAt: expires });
  }
  if (action === "suspend") {
    const x = await db.hospital.updateMany({ where: { id: h.id, subStatus: { not: "SUSPENDED" } }, data: { subStatus: "SUSPENDED" } });
    if (!x.count) throw new HttpError(409, "This hospital is already suspended");
    await audit({ hospitalId: h.id, action: "HOSPITAL_SUSPENDED", entity: "Hospital", entityId: h.id, meta: { by: "owner", from: h.subStatus } });
    return NextResponse.json({ ok: true, status: "SUSPENDED" });
  }
  throw new HttpError(400, "Unknown action");
});
