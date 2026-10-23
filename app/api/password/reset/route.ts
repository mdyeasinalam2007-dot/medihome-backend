import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { handle, HttpError, limit, ip } from "@/lib/guard";
import { hashToken } from "@/lib/resetToken";

export const POST = handle(async (req) => {
  limit("reset:" + ip(req), 10, 15 * 60_000);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").toLowerCase().trim(), token = String(b.token || ""), password = String(b.password || "");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  const rec = token ? await db.verificationToken.findUnique({ where: { token: hashToken(token) } }) : null;
  if (!rec || rec.identifier !== "reset:" + email || rec.expires < new Date()) throw new HttpError(400, "This password reset has expired or was already used. Please start again.");
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new HttpError(400, "This password reset has expired or was already used. Please start again.");
  const hash = await bcrypt.hash(password, 12);
  // One transaction: new password + single-use link removed + revocation marker (signs out sessions started before now).
  await db.$transaction(async (tx) => {
    const used = await tx.verificationToken.deleteMany({ where: { identifier: "reset:" + email } }); // link works only once
    if (!used.count) throw new HttpError(400, "This password reset has expired or was already used. Please start again."); // a parallel request won
    await tx.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PASSWORD_CHANGED", entity: "User", entityId: user.id, meta: { via: "reset" }, createdAt: new Date() } }); // app clock, same as session authAt
  });
  return NextResponse.json({ ok: true });
});
