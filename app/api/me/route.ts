import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, needUser, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";

export const GET = handle(async () => {
  const u = await needUser();
  return NextResponse.json(await db.user.findUnique({ where: { id: u.id }, select: { name: true, email: true, phone: true, role: true } }));
});
export const PUT = handle(async (req) => {
  const u = await needUser(); const b = await req.json();
  const name = String(b.name || "").trim().slice(0, 100); const phone = String(b.phone || "").trim().slice(0, 20) || null;
  if (!name) throw new HttpError(400, "Name required");
  try { await db.user.update({ where: { id: u.id }, data: { name, phone } }); } catch { throw new HttpError(409, "That phone number is already used"); }
  return NextResponse.json({ ok: true });
});
// Account deletion: personal data is erased; booking rows are kept anonymised for accounting.
export const DELETE = handle(async () => {
  const u = await needUser("PATIENT");
  await db.$transaction([
    db.account.deleteMany({ where: { userId: u.id } }), db.session.deleteMany({ where: { userId: u.id } }),
    db.user.update({ where: { id: u.id }, data: { name: "Deleted user", email: null, phone: null, passwordHash: null, image: null } }),
  ]);
  await audit({ actorId: u.id, action: "ACCOUNT_DELETED", entity: "User", entityId: u.id });
  return NextResponse.json({ ok: true });
});
