import { describe, it, expect } from "vitest";
import { bedEstimate, num } from "../lib/pricing";
import { effectiveStatus, extendExpiry, isActive } from "../lib/subscription";
import { maskPhone } from "../lib/mask";

describe("pricing", () => {
  it("computes bed estimate on the server formula", () => {
    const e = bedEstimate(2000, 3, 500, 1000);
    expect(e.accommodation).toBe(6000); expect(e.estimate).toBe(6500); expect(e.dueAtHospital).toBe(7500);
  });
  it("falls back to defaults for bad env values", () => { expect(num("abc", 10)).toBe(10); expect(num("25", 10)).toBe(25); });
});

describe("subscription", () => {
  const now = new Date("2026-01-15T00:00:00Z");
  it("is active only before expiry", () => {
    expect(isActive({ subStatus: "ACTIVE", subExpiresAt: new Date("2026-02-01") }, now)).toBe(true);
    expect(effectiveStatus({ subStatus: "ACTIVE", subExpiresAt: new Date("2026-01-01") }, now)).toBe("PAST_DUE");
    expect(isActive({ subStatus: "PENDING_PAYMENT", subExpiresAt: null }, now)).toBe(false);
    expect(isActive({ subStatus: "SUSPENDED", subExpiresAt: new Date("2027-01-01") }, now)).toBe(false);
  });
  it("extends from the later of now and current expiry", () => {
    expect(extendExpiry(null, now).toISOString().slice(0, 10)).toBe("2026-02-14");
    expect(extendExpiry(new Date("2026-02-01T00:00:00Z"), now).toISOString().slice(0, 10)).toBe("2026-03-03");
  });
});

describe("privacy", () => {
  it("masks phone numbers", () => { const m = maskPhone("01712345678"); expect(m).not.toContain("1712345"); expect(m.endsWith("678")).toBe(true); });
});
