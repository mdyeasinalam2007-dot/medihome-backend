import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { DICTS } from "../lib/i18n/dictionaries";
import { apiError } from "../lib/i18n/errors";
import { inactiveReason } from "../lib/subscription";

const src = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("hospital portal", () => {
  it("shows server errors in plain, translated words (never the API's demo wording)", () => {
    const expired = inactiveReason({ subStatus: "ACTIVE", subExpiresAt: new Date(Date.now() - 86_400_000) })!.message;
    for (const lang of ["en", "bn"] as const) {
      const t = DICTS[lang];
      const shown = apiError(t, lang, expired);
      expect(shown).toBe(t.errs.subExpired);
      expect(shown).not.toMatch(/demo|ডেমো/i);
      expect(apiError(t, lang, "Your hospital is awaiting approval by a MediHome administrator.")).toBe(t.errs.awaitingApproval);
      expect(apiError(t, lang, "This hospital account is suspended. Please contact MediHome support.")).toBe(t.errs.suspended);
      expect(apiError(t, lang, "Not enough units in stock")).toBe(t.errs.noStock);
      expect(apiError(t, lang, "Only new requests can be confirmed")).toBe(t.errs.cannotChange);
      expect(apiError(t, lang, "Available units cannot exceed total")).toBe(t.errs.availOverTotal);
      expect(apiError(t, lang, "feeBdt must be a non-negative number")).toBe(t.errs.badNumber);
      expect(apiError(t, lang, "name is required")).toBe(t.errs.fieldMissing);
    }
    // patient-side mappings keep working
    expect(apiError(DICTS.en, "en", "No units available any more")).toBe(DICTS.en.errs.noUnits);
  });

  it("has a label in both languages for every portal form field and section", () => {
    const p = src("components/Portal.tsx");
    for (const res of ["doctors", "accommodations", "tests", "profile"]) {
      for (const lang of ["en", "bn"] as const) expect(Object.keys(DICTS[lang].portal.fields[res]).sort()).toEqual(Object.keys(DICTS.en.portal.fields[res]).sort());
    }
    const keys = [...p.matchAll(/\{ k: "(\w+)"/g)].map((m) => m[1]);
    const all = new Set(Object.values(DICTS.bn.portal.fields).flatMap((f) => Object.keys(f)));
    keys.forEach((k) => expect(all.has(k)).toBe(true));
    for (const id of ["bookings", "doctors", "accommodations", "blood", "tests", "ambulance", "profile", "billing"]) {
      expect(DICTS.bn.portal.tabs[id]).toBeTruthy(); expect(DICTS.bn.portal.tabSub[id]).toBeTruthy();
    }
  });

  it("keeps the same API calls, and no browser prompt()/confirm() dialogs", () => {
    const p = src("components/Portal.tsx"), c = src("components/CrudPanel.tsx");
    expect(p).toContain("`/api/hospital/bookings/${id}`");
    expect(p).toContain('JSON.stringify({ action, note })');
    expect(p).toContain('fetch("/api/hospital/billing", { method: "POST" })');
    expect(p).toContain('fetch("/api/hospital/blood", { method: "PUT"');
    expect(c).toContain("`/api/hospital/${resource}`");
    expect(p + c).not.toMatch(/\bprompt\(|\bconfirm\("/);
  });
});
