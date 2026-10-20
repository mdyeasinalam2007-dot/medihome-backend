import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { handle, HttpError, limit, ip } from "@/lib/guard";
import { hashToken } from "@/lib/resetToken";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  limit("reset:" + ip(req), 10, 15 * 60_000);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").toLowerCase().trim(), token = String(b.token || ""), password = String(b.password || "");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  const rec = token ? await db.verificationToken.findUnique({ where: { token: hashToken(token) } }) : null;
  if (!rec || rec.identifier !== "reset:" + email || rec.expires < new Date()) throw new HttpError(400, "This reset link is invalid or has expired. Please request a new one.");
  const hash = await bcrypt.hash(password, 12);
  const [u] = await db.$transaction([
    db.user.updateMany({ where: { email }, data: { passwordHash: hash } }),
    db.verificationToken.deleteMany({ where: { identifier: "reset:" + email } }), // link works only once
  ]);
  if (!u.count) throw new HttpError(400, "This reset link is invalid or has expired. Please request a new one.");
  await audit({ action: "PASSWORD_RESET_DONE", entity: "User", meta: { email: "hidden" } });
  return NextResponse.json({ ok: true });
});
