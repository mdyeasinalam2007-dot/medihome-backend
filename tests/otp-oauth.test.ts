import { describe, it, expect, vi, beforeAll } from "vitest";

const users: Record<string, { role: string }> = { "hosp-1": { role: "HOSPITAL" }, "pat-1": { role: "PATIENT" } };
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: async ({ where }: any) => users[where.id] || null } } }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));

beforeAll(() => { process.env.NEXTAUTH_SECRET = "unit-test-secret"; });

describe("password reset codes", () => {
  it("are 6 random digits, and only a keyed hash bound to the email is stored", async () => {
    const { newOtp, hashOtp, sameHash, validCode } = await import("../lib/otp");
    const codes = new Set(Array.from({ length: 50 }, () => newOtp()));
    codes.forEach((c) => expect(validCode(c)).toBe(true));
    expect(codes.size).toBeGreaterThan(45); // random, not a counter
    const h = hashOtp("a@b.c", "123456");
    expect(h).not.toContain("123456");
    expect(sameHash(h, hashOtp("a@b.c", "123456"))).toBe(true);
    expect(sameHash(h, hashOtp("a@b.c", "123457"))).toBe(false);
    expect(sameHash(h, hashOtp("x@b.c", "123456"))).toBe(false); // a code only works for its own email
    expect(sameHash(h, "")).toBe(false);
  });
  it("rejects malformed input", async () => {
    const { validCode, validEmail } = await import("../lib/otp");
    for (const c of ["12345", "1234567", "12a456", " 123456", ""]) expect(validCode(c)).toBe(false);
    expect(validEmail("not-an-email")).toBe(false);
    expect(validEmail("a@b.co")).toBe(true);
  });
  it("email text contains the code and a do-not-share warning, in English and Bangla", async () => {
    const { otpEmail } = await import("../lib/otp");
    const m = otpEmail("482910");
    expect(m.text).toContain("482910");
    expect(m.text).toMatch(/Never share this code/);
    expect(m.text).toMatch(/কাউকে এই কোড দেবেন না/);
  });
});

describe("Google / Facebook sign-in rules", () => {
  const signIn = async (args: any) => (await import("../lib/auth")).authOptions.callbacks!.signIn!(args as any);
  it("keeps email + password sign-in working", async () => {
    expect(await signIn({ user: { id: "pat-1" }, account: { provider: "credentials" } })).toBe(true);
  });
  it("lets a new patient in with a verified Google email", async () => {
    expect(await signIn({ user: { id: "google-sub-123" }, account: { provider: "google" }, profile: { email_verified: true } })).toBe(true);
  });
  it("refuses Google accounts whose email is not verified", async () => {
    expect(await signIn({ user: { id: "google-sub-123" }, account: { provider: "google" }, profile: { email_verified: false } })).toBe(false);
  });
  it("never lets a hospital (or ambulance) account sign in through OAuth", async () => {
    expect(await signIn({ user: { id: "hosp-1" }, account: { provider: "facebook" }, profile: {} })).toBe(false);
  });
  it("does not link accounts by matching email (account takeover protection)", async () => {
    const { authOptions } = await import("../lib/auth");
    for (const p of authOptions.providers as any[]) expect(p.options?.allowDangerousEmailAccountLinking ?? p.allowDangerousEmailAccountLinking).not.toBe(true);
    expect(authOptions.pages?.error).toBe("/login");
  });
});
