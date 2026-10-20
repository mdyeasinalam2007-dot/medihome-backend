import { NextResponse } from "next/server";
import { db } from "./db";
import { me } from "./auth";
import { isActive } from "./subscription";

export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

export const handle = (fn: (req: Request, ctx: any) => Promise<Response>) => async (req: Request, ctx: any) => {
  try { return await fn(req, ctx); }
  catch (e: any) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("API error:", e?.message); // never log bodies / secrets
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
};

export async function needUser(role?: "PATIENT" | "HOSPITAL" | "AMBULANCE") {
  const u = await me();
  if (!u) throw new HttpError(401, "Please sign in");
  if (role && u.role !== role) throw new HttpError(403, "Not allowed for this account type");
  return u;
}

// Ownership is resolved from the session user, never from client input.
export async function needHospital(requireActive = false) {
  const u = await needUser("HOSPITAL");
  const h = await db.hospital.findUnique({ where: { userId: u.id } });
  if (!h) throw new HttpError(403, "No hospital linked to this account");
  if (requireActive && !isActive(h)) throw new HttpError(402, "Your subscription is not active. Please pay to continue.");
  return { u, h };
}

const hits = new Map<string, number[]>();
export function limit(key: string, max: number, windowMs: number) {
  const now = Date.now(), a = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (a.length >= max) throw new HttpError(429, "Too many requests, please wait a moment");
  a.push(now); hits.set(key, a);
}
export const ip = (req: Request) => (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();

// Ambulance ownership is resolved from the session user, never from client input.
// Ambulance providers AND hospitals can run ambulances (a hospital gets its provider record on first use).
export async function needProvider(write = false) {
  const u = await needUser();
  if (u.role !== "AMBULANCE" && u.role !== "HOSPITAL") throw new HttpError(403, "Not allowed for this account type");
  let p = await db.ambulanceProvider.findUnique({ where: { userId: u.id } });
  if (u.role === "HOSPITAL") {
    const h = await db.hospital.findUnique({ where: { userId: u.id } });
    if (!h) throw new HttpError(403, "No hospital linked to this account");
    if (write && !isActive(h)) throw new HttpError(402, "Your subscription is not active. Please pay to continue.");
    if (!p) p = await db.ambulanceProvider.create({ data: { userId: u.id, name: h.name, area: h.location, phone: h.phone } });
  }
  if (!p) throw new HttpError(403, "No ambulance service linked to this account");
  return { u, p };
}
