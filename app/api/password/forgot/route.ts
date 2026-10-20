import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, HttpError, limit, ip } from "@/lib/guard";
import { newToken, hashToken } from "@/lib/resetToken";
import { sendMail } from "@/lib/mail";
import { audit } from "@/lib/audit";

// Always answers the same way, so nobody can use this form to discover which emails have accounts.
export const POST = handle(async (req) => {
  limit("forgot:" + ip(req), 6, 15 * 60_000);
  const b = await req.json().catch(() => ({})); const email = String(b.email || "").toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
  limit("forgot-email:" + email, 3, 60 * 60_000);
  const u = await db.user.findUnique({ where: { email } });
  if (u?.passwordHash) { // accounts created with Google/Facebook have no password to reset
    const raw = newToken(), id = "reset:" + email;
    await db.verificationToken.deleteMany({ where: { identifier: id } }); // only the newest link works
    await db.verificationToken.create({ data: { identifier: id, token: hashToken(raw), expires: new Date(Date.now() + 30 * 60_000) } });
    const link = `${process.env.NEXTAUTH_URL}/reset-password?token=${raw}&email=${encodeURIComponent(email)}`;
    const r = await sendMail({ to: email, subject: "Reset your MediHome password", text: `Hello,\n\nUse this link to choose a new password (valid for 30 minutes):\n${link}\n\nIf you did not ask for this, ignore this email: your password stays the same.\n\nMediHome` });
    await audit({ actorId: u.id, action: "PASSWORD_RESET_REQUESTED", entity: "User", entityId: u.id, meta: { mail: r } });
  }
  return NextResponse.json({ ok: true, message: "If an account with this email uses a password, a reset link has been sent. It is valid for 30 minutes." });
});
