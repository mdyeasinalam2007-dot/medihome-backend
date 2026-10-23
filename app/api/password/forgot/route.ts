import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, HttpError, limit, ip } from "@/lib/guard";
import { sendMail } from "@/lib/mail";
import { audit } from "@/lib/audit";
import { OTP_TTL_MS, failId, hashOtp, newOtp, otpEmail, otpId, validEmail } from "@/lib/otp";

// Step 1 of "Forgot password": email a one-time code (see lib/otp.ts).
// Always answers the same way, so nobody can use this form to discover which emails have accounts.
export const POST = handle(async (req) => {
  limit("forgot:" + ip(req), 6, 15 * 60_000);
  const b = await req.json().catch(() => ({})); const email = String(b.email || "").toLowerCase().trim();
  if (!validEmail(email)) throw new HttpError(400, "Enter a valid email address");
  limit("forgot-email:" + email, 3, 60 * 60_000);
  const u = await db.user.findUnique({ where: { email } });
  if (u?.passwordHash) { // accounts created with Google/Facebook have no password to reset
    const code = newOtp();
    await db.$transaction([ // only the newest code works, and the attempt counter starts again
      db.verificationToken.deleteMany({ where: { identifier: { in: [otpId(email), failId(email)] } } }),
      db.verificationToken.create({ data: { identifier: otpId(email), token: hashOtp(email, code), expires: new Date(Date.now() + OTP_TTL_MS) } }),
    ]);
    const r = await sendMail({ to: email, ...otpEmail(code) });
    await audit({ actorId: u.id, action: "PASSWORD_RESET_REQUESTED", entity: "User", entityId: u.id, meta: { mail: r, via: "code" } });
  }
  return NextResponse.json({ ok: true, message: "If an account with this email uses a password, a verification code has been sent." });
});
