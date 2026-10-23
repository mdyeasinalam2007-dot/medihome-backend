import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getToken } from "next-auth/jwt";
import { handle, needUser, HttpError, limit } from "@/lib/guard";
import { holdsBed, moveBooking, releaseBed, rule } from "@/lib/bookingFlow";

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
// Account deletion (patients). Done entirely on the server for the signed-in user only (the id comes from the session,
// never from the request). Steps, in one transaction:
//  1) confirm it is really the account owner: current password, or a sign-in within the last 10 minutes for
//     Google/Facebook accounts (they have no password);
//  2) cancel open bookings with the normal patient-cancel rule (held beds are released) and open ambulance requests;
//  3) erase personal data (name, email, phone, password, photo) and linked sign-in accounts; booking rows are kept
//     without the name for the hospitals' accounting;
//  4) write ACCOUNT_DELETED, which ends this account's sessions on every device (see lib/sessionRevocation.ts).
// Hospital and ambulance accounts are tied to listings and other patients' bookings, so they are closed by support.
const REAUTH_MS = 10 * 60_000;
export const DELETE = handle(async (req) => {
  const u = await needUser();
  if (u.role !== "PATIENT") throw new HttpError(403, "Hospital and ambulance accounts can't be deleted here. Please contact MediHome support.");
  limit("delete:" + u.id, 5, 15 * 60_000);
  const b = await req.json().catch(() => ({}));
  const user = await db.user.findUnique({ where: { id: u.id }, select: { passwordHash: true } });
  if (!user) throw new HttpError(404, "Account not found");
  if (user.passwordHash) {
    if (!b?.password || !(await bcrypt.compare(String(b.password), user.passwordHash))) throw new HttpError(401, "The password is not correct.");
  } else {
    const tok = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    if (!tok?.authAt || Date.now() - Number(tok.authAt) > REAUTH_MS) throw new HttpError(401, "For your security, please sign in again before deleting your account.");
  }
  const from = rule("patient", "cancel")!.from;
  const open = await db.booking.findMany({ where: { patientId: u.id, status: { in: from } } });
  await db.$transaction(async (tx) => {
    for (const bk of open) {
      await moveBooking(tx, { id: bk.id, patientId: u.id }, from, { status: "CANCELLED" });
      if (holdsBed(bk)) await releaseBed(tx, bk.itemRef!); // give the held bed back
      await tx.auditLog.create({ data: { actorId: u.id, hospitalId: bk.hospitalId, action: "BOOKING_CANCELLED_BY_PATIENT", entity: "Booking", entityId: bk.id, meta: { reason: "account deleted" } } });
    }
    await tx.ambulanceBooking.updateMany({ where: { patientId: u.id, status: { in: ["PENDING", "ACCEPTED", "CONFIRMED"] } }, data: { status: "CANCELLED" } });
    await tx.account.deleteMany({ where: { userId: u.id } });
    await tx.session.deleteMany({ where: { userId: u.id } });
    await tx.user.update({ where: { id: u.id }, data: { name: "Deleted user", email: null, phone: null, passwordHash: null, image: null } });
    // app clock, same as the session's authAt: every session of this account (all devices) is now rejected
    await tx.auditLog.create({ data: { actorId: u.id, action: "ACCOUNT_DELETED", entity: "User", entityId: u.id, meta: { cancelledBookings: open.length }, createdAt: new Date() } });
  });
  return NextResponse.json({ ok: true });
});
