import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
vi.mock("@/lib/db", async () => ({ db: (await import("./helpers/fakeDb")).fakeDb, dbConfigError: (await import("../lib/dbConfig")).dbConfigError }));

import * as F from "./helpers/fakeDb";
import { dbConfigError } from "../lib/dbConfig";
import { getProvider, geminiTargets } from "../lib/ai";
import { GET as health } from "../app/api/health/route";
import { isRevoked } from "../lib/sessionRevocation";
import { authOptions } from "../lib/auth";
const nextConfig = require("../next.config.js");

const ENV = { ...process.env };
beforeEach(() => F.reset());
afterEach(() => { process.env = { ...ENV }; vi.restoreAllMocks(); });

describe("no hardcoded credentials", () => {
  const src = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
  it("lib/db and lib/ai contain no connection strings, keys or key-in-URL", () => {
    for (const f of ["lib/db.ts", "lib/dbConfig.ts", "lib/ai.ts"]) {
      const s = src(f);
      expect(s).not.toMatch(/postgres(ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/); // user:password@host
      expect(s).not.toMatch(/\?key=/);
      expect(s).not.toMatch(/Buffer\.from\(\s*["'][A-Za-z0-9+/=]{30,}["']/); // obfuscated key
      expect(s).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    }
  });
});

describe("database configuration", () => {
  it("reports a clear error instead of falling back", () => {
    expect(dbConfigError("")).toMatch(/DATABASE_URL is not set/);
    expect(dbConfigError("file:./dev.db")).toMatch(/PostgreSQL/);
    expect(dbConfigError("postgresql://u:p@h/db")).toBeNull();
  });
});

describe("Gemini", () => {
  it("is not available without GEMINI_API_KEY (no built-in key)", () => {
    delete process.env.GEMINI_API_KEY; delete process.env.OLLAMA_MODEL;
    process.env.AI_PROVIDER = "gemini"; expect(getProvider()).toBeNull();
    process.env.AI_PROVIDER = "auto"; expect(getProvider()).toBeNull();
  });
  it("never puts the key in the URL, only in the x-goog-api-key header", async () => {
    for (const t of geminiTargets("gemini-x", "SECRET-KEY-123")) {
      expect(t.url).not.toContain("SECRET-KEY-123"); expect(t.url).not.toContain("key=");
      expect(t.headers["x-goog-api-key"]).toBe("SECRET-KEY-123");
    }
    process.env.GEMINI_API_KEY = "SECRET-KEY-123"; process.env.AI_PROVIDER = "gemini";
    const seen: { url: string; headers: any }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any, init: any) => {
      seen.push({ url: String(url), headers: init.headers });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "hi" }] } }] }), { status: 200 });
    });
    expect(await getProvider()!.generate({ system: "s", messages: [{ role: "user", text: "hello" }] })).toBe("hi");
    expect(seen).toHaveLength(1);
    expect(seen[0].url).not.toContain("SECRET-KEY-123");
    expect(seen[0].headers["x-goog-api-key"]).toBe("SECRET-KEY-123");
  });
});

describe("public health endpoint", () => {
  it("returns only ok when the database answers", async () => {
    process.env.DATABASE_URL = "postgresql://u:p@h/db";
    const r = await health();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok" });
  });
  it("returns only error (503) when the database fails, with no details", async () => {
    process.env.DATABASE_URL = "postgresql://u:p@h/db";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const orig = F.fakeDb.$queryRaw; F.fakeDb.$queryRaw = async () => { throw Object.assign(new Error("connect to db.example.com failed"), { code: "P1001" }); };
    try {
      const r = await health();
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ status: "error" });
    } finally { F.fakeDb.$queryRaw = orig; }
  });
  it("returns error when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL; vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await health()).status).toBe(503);
  });
});

describe("security headers", () => {
  it("sets CSP, HSTS, nosniff, frame protection, referrer and permissions policies on every route", async () => {
    const [rule] = await nextConfig.headers();
    expect(rule.source).toBe("/:path*");
    const h = Object.fromEntries(rule.headers.map((x: any) => [x.key, x.value]));
    expect(h["Content-Security-Policy"]).toMatch(/frame-ancestors 'none'/);
    expect(h["Content-Security-Policy"]).toMatch(/object-src 'none'/);
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toMatch(/microphone=\(self\)/); // voice chat keeps working
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("password reset ends older sessions", () => {
  it("revokes sessions that signed in before the change", () => {
    const t = new Date("2026-10-22T10:00:00Z");
    expect(isRevoked(t.getTime() - 1000, t)).toBe(true);
    expect(isRevoked(t.getTime() + 1000, t)).toBe(false);
    expect(isRevoked(undefined, t)).toBe(true); // sessions from before this feature
    expect(isRevoked(t.getTime(), null)).toBe(false);
  });

  it("the NextAuth jwt callback drops a revoked session and keeps a fresh one", async () => {
    const jwt = authOptions.callbacks!.jwt! as any;
    F.rows("user").push({ id: "u1", role: "PATIENT" });
    const old = { uid: "u1", role: "PATIENT", authAt: Date.now() - 60_000 };
    expect((await jwt({ token: { ...old } })).uid).toBe("u1"); // no password change yet

    F.rows("auditLog").push({ id: "a1", entity: "User", entityId: "u1", action: "PASSWORD_CHANGED", createdAt: new Date() });
    expect(await jwt({ token: { ...old } })).toEqual({}); // signed in before the reset -> signed out

    const fresh = await jwt({ token: {}, user: { id: "u1" } }); // signing in again after the reset works
    expect(fresh.uid).toBe("u1"); expect(fresh.role).toBe("PATIENT");

    const session = await (authOptions.callbacks!.session as any)({ session: { user: { name: "x" }, expires: "" }, token: {} });
    expect(session.user).toBeUndefined();
  });

  it("keeps the session if the revocation check itself fails (database blip)", async () => {
    const jwt = authOptions.callbacks!.jwt! as any;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const orig = F.fakeDb.auditLog.findFirst; F.fakeDb.auditLog.findFirst = async () => { throw new Error("db down"); };
    try { expect((await jwt({ token: { uid: "u1", role: "PATIENT", authAt: 1 } })).uid).toBe("u1"); }
    finally { F.fakeDb.auditLog.findFirst = orig; }
  });
});
