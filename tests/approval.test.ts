import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("@/lib/db", async () => ({ db: (await import("./helpers/fakeDb")).fakeDb, dbConfigError: () => null }));
vi.mock("@/lib/auth", async () => ({ me: async () => (await import("./helpers/fakeDb")).currentUser() }));

import * as F from "./helpers/fakeDb";
import { POST as register } from "../app/api/register/route";
import { GET as resourceGet, POST as resourcePost } from "../app/api/hospital/[resource]/route";
import { GET as ownerList, POST as ownerAct } from "../app/api/owner/hospitals/route";
import { canRenew, inactiveReason, isApproved, NEW_HOSPITAL_STATUS } from "../lib/subscription";
import { safeEqual, ownerConfigured } from "../lib/owner";

const KEY = "test-owner-key-0123456789";
let ipN = 0;
const ownerReq = (body?: any, key = KEY, ip = "10.0.0." + ++ipN) => F.req("/api/owner/hospitals", body, { "x-owner-key": key, "x-forwarded-for": ip });
const billing = (method: "GET" | "POST") => F.call(method === "GET" ? resourceGet : resourcePost, F.req("/api/hospital/billing", method === "GET" ? undefined : {}), { resource: "billing" });

beforeEach(() => { F.reset(); process.env.OWNER_KEY = KEY; });
afterEach(() => { delete process.env.OWNER_KEY; });

describe("approval rules (pure)", () => {
  const now = new Date("2026-10-22T00:00:00Z"), day = 86_400_000;
  it("only ACTIVE counts as approved", () => {
    expect(isApproved({ subStatus: "ACTIVE" })).toBe(true);
    for (const s of ["PENDING_VERIFICATION", "PENDING_PAYMENT", "SUSPENDED", "PAST_DUE"]) expect(isApproved({ subStatus: s })).toBe(false);
  });
  it("opens demo renewal only near or after expiry, and never for unapproved hospitals", () => {
    expect(canRenew({ subStatus: "PENDING_VERIFICATION", subExpiresAt: null }, now)).toBe(false);
    expect(canRenew({ subStatus: "SUSPENDED", subExpiresAt: new Date(+now - day) }, now)).toBe(false);
    expect(canRenew({ subStatus: "ACTIVE", subExpiresAt: new Date(+now + 20 * day) }, now)).toBe(false);
    expect(canRenew({ subStatus: "ACTIVE", subExpiresAt: new Date(+now + 3 * day) }, now)).toBe(true);
    expect(canRenew({ subStatus: "ACTIVE", subExpiresAt: new Date(+now - 3 * day) }, now)).toBe(true);
  });
  it("explains why a hospital is inactive", () => {
    expect(inactiveReason({ subStatus: "ACTIVE", subExpiresAt: new Date(+now + day) }, now)).toBeNull();
    expect(inactiveReason({ subStatus: "PENDING_VERIFICATION", subExpiresAt: null }, now)?.message).toMatch(/approval/);
    expect(inactiveReason({ subStatus: "SUSPENDED", subExpiresAt: null }, now)?.status).toBe(403);
    expect(inactiveReason({ subStatus: "ACTIVE", subExpiresAt: new Date(+now - day) }, now)?.status).toBe(402);
  });
});

describe("hospital registration", () => {
  it("creates new hospitals as pending, unpaid and without a free subscription", async () => {
    const r = await F.call(register, F.req("/api/register", { role: "HOSPITAL", name: "Ms. Contact", email: "h1@example.com", password: "password123",
      hospital: { name: "New Hospital", address: "Road 2", phone: "0170000", license: "LIC-1" } }, { "x-forwarded-for": "10.9.9.1" }));
    expect(r.status).toBe(201);
    expect(r.body.pendingApproval).toBe(true);
    const h = F.rows("hospital")[0];
    expect(h.subStatus).toBe(NEW_HOSPITAL_STATUS);
    expect(h.subExpiresAt).toBeNull();
    expect(h.regPaid).toBe(false);
  });
});

describe("billing (demo)", () => {
  it("never lets a pending hospital activate or extend itself", async () => {
    const { h, user } = F.seedHospital({ subStatus: "PENDING_VERIFICATION", subExpiresAt: null, regPaid: false }); F.signIn(user);
    for (let i = 0; i < 3; i++) expect((await billing("POST")).status).toBe(403);
    const after = F.rows("hospital").find((x) => x.id === h.id)!;
    expect(after.subStatus).toBe("PENDING_VERIFICATION"); expect(after.subExpiresAt).toBeNull();
    const info = await billing("GET");
    expect(info.body.approved).toBe(false); expect(info.body.canRenew).toBe(false); expect(info.body.mode).toBe("demo");
    expect(info.body.destination).toBeUndefined(); // the owner's payment number is no longer exposed
  });

  it("lets an approved hospital renew once inside the window, and repeated clicks cannot stack months", async () => {
    const exp = F.future(3);
    const { h, user } = F.seedHospital({ subExpiresAt: exp }); F.signIn(user);
    const first = await billing("POST");
    expect(first.status).toBe(200); expect(first.body.demo).toBe(true);
    const after = F.rows("hospital").find((x) => x.id === h.id)!.subExpiresAt as Date;
    expect(Math.round((+after - +exp) / 86_400_000)).toBe(30);
    for (let i = 0; i < 3; i++) expect((await billing("POST")).status).toBe(409);
    expect(F.rows("hospital").find((x) => x.id === h.id)!.subExpiresAt).toEqual(after);
  });

  it("refuses early renewal far from expiry", async () => {
    const { user } = F.seedHospital({ subExpiresAt: F.future(20) }); F.signIn(user);
    expect((await billing("POST")).status).toBe(409);
  });

  it("blocks suspended hospitals", async () => {
    const { user } = F.seedHospital({ subStatus: "SUSPENDED" }); F.signIn(user);
    expect((await billing("POST")).status).toBe(403);
  });

  it("blocks pending hospitals from publishing listings", async () => {
    const { user } = F.seedHospital({ subStatus: "PENDING_VERIFICATION", subExpiresAt: null }); F.signIn(user);
    const r = await F.call(resourcePost, F.req("/api/hospital/doctors", { name: "Dr X", specialty: "Medicine", feeBdt: 100 }), { resource: "doctors" });
    expect(r.status).toBe(403); expect(r.body.error).toMatch(/approval/);
    expect(F.rows("doctor")).toHaveLength(0);
  });
});

describe("admin approval (/api/owner/hospitals)", () => {
  it("is disabled when OWNER_KEY is not configured", async () => {
    delete process.env.OWNER_KEY;
    expect((await F.call(ownerList, ownerReq())).status).toBe(503);
  });

  it("rejects a wrong key and locks out guessing before comparing", async () => {
    const ip = "10.1.1.1";
    for (let i = 0; i < 10; i++) expect((await F.call(ownerList, ownerReq(undefined, "wrong-key-wrong-key", ip))).status).toBe(401);
    expect((await F.call(ownerList, ownerReq(undefined, KEY, ip))).status).toBe(429); // even the right key is refused during lockout
  });

  it("approves a pending hospital exactly once, then can suspend it", async () => {
    const { h } = F.seedHospital({ subStatus: "PENDING_VERIFICATION", subExpiresAt: null, regPaid: false });
    const list = await F.call(ownerList, ownerReq());
    expect(list.status).toBe(200); expect(list.body[0].id).toBe(h.id);
    const ok = await F.call(ownerAct, ownerReq({ id: h.id, action: "approve" }));
    expect(ok.status).toBe(200);
    const row = F.rows("hospital")[0];
    expect(row.subStatus).toBe("ACTIVE");
    expect(Math.round((+row.subExpiresAt - Date.now()) / 86_400_000)).toBe(30);
    expect((await F.call(ownerAct, ownerReq({ id: h.id, action: "approve" }))).status).toBe(409);
    expect((await F.call(ownerAct, ownerReq({ id: h.id, action: "suspend" }))).status).toBe(200);
    expect(F.rows("hospital")[0].subStatus).toBe("SUSPENDED");
    expect(F.rows("auditLog").map((a) => a.action)).toEqual(["HOSPITAL_APPROVED", "HOSPITAL_SUSPENDED"]);
  });

  it("compares keys safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(ownerConfigured("short")).toBe(false);
    expect(ownerConfigured(KEY)).toBe(true);
  });
});
