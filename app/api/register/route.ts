import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { handle, HttpError, limit, ip } from "@/lib/guard";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  limit("reg:" + ip(req), 8, 60_000);
  const b = await req.json().catch(() => null);
  const email = String(b?.email || "").toLowerCase().trim(), name = String(b?.name || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || String(b?.password || "").length < 8 || !name) throw new HttpError(400, "Name, valid email and a password of 8+ characters are required");
  if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, "This email is already registered");
  const isH = b.role === "HOSPITAL", isA = b.role === "AMBULANCE", h = b.hospital || {}, am = b.ambulance || {};
  if (isA && !(am.name && am.area && am.phone)) throw new HttpError(400, "Service name, area and phone are required");
  if (isH && !(h.name && h.address && h.phone && h.license)) throw new HttpError(400, "Hospital name, address, phone and licence/registration number are required");
  const u = await db.user.create({
    data: {
      name, email, passwordHash: await bcrypt.hash(b.password, 12), role: isH ? "HOSPITAL" : isA ? "AMBULANCE" : "PATIENT",
      ...(isA && { ambulanceProvider: { create: { name: String(am.name).slice(0, 200), area: String(am.area).slice(0, 120), phone: String(am.phone).slice(0, 30) } } }),
      ...(isH && { hospital: { create: { name: String(h.name).slice(0, 200), contactPerson: name, phone: String(h.phone).slice(0, 30), address: String(h.address).slice(0, 400), location: String(h.location || "").slice(0, 120), license: String(h.license).slice(0, 100), subStatus: "ACTIVE", subExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), regPaid: true, emergency: String(h.emergency || "").slice(0, 30), description: String(h.description || "").slice(0, 2000) } } }),
    },
  });
  await audit({ actorId: u.id, action: isH ? "HOSPITAL_REGISTERED" : isA ? "AMBULANCE_REGISTERED" : "PATIENT_REGISTERED", entity: "User", entityId: u.id });
  return NextResponse.json({ ok: true }, { status: 201 });
});

