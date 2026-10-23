import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { safeNext, loginFor } from "../lib/safeNext";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("return to the right page after sign-in", () => {
  it("accepts same-site paths", () => {
    expect(safeNext("/bookings/abc123")).toBe("/bookings/abc123");
    expect(safeNext("/portal")).toBe("/portal");
    expect(safeNext("/doctors?q=heart")).toBe("/doctors?q=heart");
  });

  it("never redirects to another site (no open redirect)", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "\\\\evil", "javascript:alert(1)", " /x", "", null, undefined])
      expect(safeNext(bad as string)).toBe("/dashboard");
  });

  it("does not loop back to sign-in pages or into the API", () => {
    for (const p of ["/login", "/login?next=/x", "/register", "/api/auth/signout"]) expect(safeNext(p)).toBe("/dashboard");
  });

  it("hospital sign-up marks the same fields required as the server checks", () => {
    const page = read("app/register/page.tsx"), api = read("app/api/register/route.ts");
    expect(page).toMatch(/const H_REQUIRED = \["name", "address", "phone", "license"\]/);
    expect(api).toMatch(/isH && !\(h\.name && h\.address && h\.phone && h\.license\)/);
  });

  it("protected pages send signed-out visitors to sign-in with their own address", () => {
    expect(loginFor("/bookings/x1")).toBe("/login?next=%2Fbookings%2Fx1");
    expect(read("app/bookings/[id]/page.tsx")).toMatch(/redirect\(loginFor\("\/bookings\/" \+ params\.id\)\)/);
    expect(read("app/portal/page.tsx")).toMatch(/redirect\(loginFor\("\/portal"\)\)/);
    expect(read("app/provider/page.tsx")).toMatch(/redirect\(loginFor\("\/provider"\)\)/);
    expect(read("app/dashboard/page.tsx")).toMatch(/redirect\(loginFor\("\/dashboard"\)\)/);
    expect(read("app/login/page.tsx")).toMatch(/safeNext\(new URLSearchParams\(window\.location\.search\)\.get\("next"\)\)/);
  });
});
