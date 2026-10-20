import crypto from "crypto";
// The raw token only ever exists in the emailed link. The database stores its SHA-256 hash.
export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (t: string) => crypto.createHash("sha256").update(String(t)).digest("hex");
