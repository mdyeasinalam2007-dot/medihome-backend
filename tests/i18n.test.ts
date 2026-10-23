import { describe, it, expect } from "vitest";
import { DICTS, parseLang, LANG_COOKIE, LANGS } from "../lib/i18n/dictionaries";

// Walks both dictionaries and returns problems: missing keys, empty strings, or arrays of different length.
function compare(a: any, b: any, path = ""): string[] {
  if (typeof a === "string") return typeof b === "string" && b.trim() ? [] : [`${path}: missing or empty`];
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return [`${path}: array length differs`];
    return a.flatMap((x, i) => compare(x, b[i], `${path}[${i}]`));
  }
  return Object.keys(a).flatMap((k) => (b && k in b ? compare(a[k], b[k], path ? `${path}.${k}` : k) : [`${path}.${k}: missing`]));
}

describe("dictionaries", () => {
  it("Bangla has every English key, with non-empty text", () => {
    expect(compare(DICTS.en, DICTS.bn)).toEqual([]);
  });
  it("Bangla really is translated (not a copy of English)", () => {
    expect(DICTS.bn.nav.doctors).not.toBe(DICTS.en.nav.doctors);
    expect(DICTS.bn.home.sub).toMatch(/[ঀ-৿]/);
  });
  it("keeps the AI name Ratchet in both languages", () => {
    for (const l of LANGS) { expect(DICTS[l].nav.ratchet).toContain("Ratchet"); expect(DICTS[l].home.ratchetText).toContain("Ratchet"); }
  });
  it("contains no demo-mode wording in either language", () => {
    expect(JSON.stringify(DICTS.en)).not.toMatch(/demo/i);
    expect(JSON.stringify(DICTS.bn)).not.toMatch(/ডেমো|demo/i);
  });
  it("specialty shortcuts use the same search values in both languages, so URLs are identical", () => {
    expect(DICTS.bn.home.specialties.map((s) => s.q)).toEqual(DICTS.en.home.specialties.map((s) => s.q));
  });
});

describe("language preference", () => {
  it("accepts only en / bn and falls back to English", () => {
    expect(parseLang("bn")).toBe("bn");
    expect(parseLang("en")).toBe("en");
    for (const bad of [undefined, null, "", "BN", "fr", "bn;evil", 1]) expect(parseLang(bad)).toBe("en");
  });
  it("uses the mh_lang cookie", () => expect(LANG_COOKIE).toBe("mh_lang"));
});
