import crypto from "crypto";
// Signed, short-lived, single-use confirmation tokens: the server only books what the patient actually reviewed.
const key = () => { const k = process.env.NEXTAUTH_SECRET; if (!k) throw new Error("NEXTAUTH_SECRET is not set"); return k; };
const mac = (body: string) => crypto.createHmac("sha256", key()).update(body).digest("base64url");
export function signToken(p: any, ttlMs = 10 * 60_000) {
  const body = Buffer.from(JSON.stringify({ ...p, exp: Date.now() + ttlMs, jti: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  return body + "." + mac(body);
}
export function verifyToken(t: string): any | null {
  const [body, sig] = String(t || "").split("."); if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(mac(body)); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
const used = new Map<string, number>();
export function consume(jti: string) { // single use (per server process)
  const now = Date.now(); for (const [k, v] of used) if (v < now) used.delete(k);
  if (used.has(jti)) return false; used.set(jti, now + 11 * 60_000); return true;
}
