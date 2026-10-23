import crypto from "crypto";

// One-time codes for "Forgot password".
// - 6 random digits from a cryptographic generator, valid for OTP_TTL_MS and usable once.
// - Only a keyed hash (HMAC-SHA256 with NEXTAUTH_SECRET, bound to the email) is stored, never the code itself.
// - Wrong guesses are counted in the database (identifier "otpfail:<email>"), so the limit survives restarts and
//   works across server instances; after MAX_ATTEMPTS the code is destroyed and a new one must be requested.
// - A correct code is exchanged for a short-lived single-use reset ticket ("reset:<email>"), which the existing
//   /api/password/reset endpoint consumes. Rows live in the existing VerificationToken table (no schema change).
export const OTP_TTL_MS = 10 * 60_000;
export const TICKET_TTL_MS = 15 * 60_000;
export const MAX_ATTEMPTS = 5;
export const otpId = (email: string) => "otp:" + email;
export const failId = (email: string) => "otpfail:" + email;
export const ticketId = (email: string) => "reset:" + email;

export const newOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

function secret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}
export const hashOtp = (email: string, code: string) => crypto.createHmac("sha256", secret()).update(`otp:${email}:${code}`).digest("hex");

// Constant-time comparison of two hex digests.
export function sameHash(a: string, b: string) {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
export const validCode = (c: string) => /^\d{6}$/.test(c);

export function otpEmail(code: string) {
  const mins = OTP_TTL_MS / 60_000;
  return {
    subject: "Your MediHome verification code / আপনার MediHome যাচাই কোড",
    text: `Your MediHome password reset code is: ${code}\n\nIt is valid for ${mins} minutes and can be used once. Never share this code with anyone; MediHome staff will never ask for it.\nIf you did not ask to reset your password, ignore this email: your password stays the same.\n\n---\n\nআপনার MediHome পাসওয়ার্ড রিসেট কোড: ${code}\n\nকোডটি ${mins} মিনিট বৈধ এবং একবারই ব্যবহার করা যাবে। কাউকে এই কোড দেবেন না; MediHome কখনো এটি চাইবে না।\nআপনি পাসওয়ার্ড রিসেট করতে না চাইলে এই ইমেইল উপেক্ষা করুন: আপনার পাসওয়ার্ড একই থাকবে।\n\nMediHome`,
  };
}
