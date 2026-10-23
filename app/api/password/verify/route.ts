import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, HttpError, limit, ip } from "@/lib/guard";
import { hashToken } from "@/lib/resetToken";
import { MAX_ATTEMPTS, TICKET_TTL_MS, failId, hashOtp, otpId, sameHash, ticketId, validCode, validEmail } from "@/lib/otp";

const EXPIRED = "This code has expired or is no longer valid. Please request a new code.";
const TOO_MANY = "Too many incorrect attempts. Please request a new code.";

// Step 2 of "Forgot password": check the emailed code. A correct code is used up immediately and exchanged for a
// short-lived, single-use reset ticket; /api/password/reset then sets the new password.
export const POST = handle(async (req) => {
  limit("otp:" + ip(req), 20, 15 * 60_000);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").toLowerCase().trim(), code = String(b.code || "").trim();
  if (!validEmail(email) || !validCode(code)) throw new HttpError(400, "Enter the 6-digit code from the email.");
  limit("otp-email:" + email, 10, 15 * 60_000);

  const rec = await db.verificationToken.findFirst({ where: { identifier: otpId(email) } });
  if (!rec || rec.expires < new Date()) {
    if (rec) await db.verificationToken.deleteMany({ where: { identifier: { in: [otpId(email), failId(email)] } } });
    throw new HttpError(400, EXPIRED);
  }
  const fails = await db.verificationToken.count({ where: { identifier: failId(email) } });
  if (fails >= MAX_ATTEMPTS) {
    await db.verificationToken.deleteMany({ where: { identifier: { in: [otpId(email), failId(email)] } } });
    throw new HttpError(429, TOO_MANY);
  }
  if (!sameHash(rec.token, hashOtp(email, code))) {
    await db.verificationToken.create({ data: { identifier: failId(email), token: "f_" + crypto.randomBytes(16).toString("hex"), expires: rec.expires } });
    if (fails + 1 >= MAX_ATTEMPTS) {
      await db.verificationToken.deleteMany({ where: { identifier: { in: [otpId(email), failId(email)] } } });
      throw new HttpError(429, TOO_MANY);
    }
    throw new HttpError(400, "Incorrect code. Please check the email and try again.");
  }

  const ticket = crypto.randomBytes(32).toString("base64url");
  await db.$transaction(async (tx) => {
    // single use: only the request that actually deletes the code may continue (a parallel request gets "expired")
    const used = await tx.verificationToken.deleteMany({ where: { identifier: otpId(email), token: rec.token } });
    if (!used.count) throw new HttpError(400, EXPIRED);
    await tx.verificationToken.deleteMany({ where: { identifier: { in: [failId(email), ticketId(email)] } } });
    await tx.verificationToken.create({ data: { identifier: ticketId(email), token: hashToken(ticket), expires: new Date(Date.now() + TICKET_TTL_MS) } });
  });
  return NextResponse.json({ ok: true, ticket });
});
