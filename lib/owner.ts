import crypto from "crypto";
import { HttpError, ip } from "./guard";

// Administrator access for the site owner (/owner). Protected by the OWNER_KEY environment variable (16+ characters),
// sent by the admin page in the x-owner-key header. The key is never stored in the database, a cookie or a URL.
export const MIN_OWNER_KEY = 16;
export const ownerConfigured = (k = process.env.OWNER_KEY) => String(k || "").length >= MIN_OWNER_KEY;

export function safeEqual(a: string, b: string) {
  const x = crypto.createHash("sha256").update(a).digest(), y = crypto.createHash("sha256").update(b).digest(); // equal length for timingSafeEqual
  return crypto.timingSafeEqual(x, y) && a.length === b.length;
}

// Failed attempts per IP. The lockout is checked BEFORE comparing, so guessing can't continue during a lockout.
const fails = new Map<string, number[]>();
const MAX_FAILS = 10, WINDOW = 15 * 60_000;

export function needOwner(req: Request, now = Date.now()) {
  if (!ownerConfigured()) throw new HttpError(503, "Admin approval is not configured. Set OWNER_KEY (16+ characters) in the server environment.");
  const who = ip(req), recent = (fails.get(who) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= MAX_FAILS) throw new HttpError(429, "Too many wrong attempts. Please wait 15 minutes.");
  const given = req.headers.get("x-owner-key") || "";
  if (!given || !safeEqual(given, String(process.env.OWNER_KEY))) {
    recent.push(now); fails.set(who, recent);
    throw new HttpError(401, "Wrong admin key");
  }
}
