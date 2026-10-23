import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { SLIDES, buildCycle } from "@/lib/heroSlides";
import { getDictFor } from "@/lib/i18n/dictionaries";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const css = read("app/globals.css");
const rule = (sel: string) => { const i = css.indexOf(sel + "{"); return i < 0 ? "" : css.slice(i, css.indexOf("}", i)); };

describe("homepage hero", () => {
  it("gives italic gradient words room to paint their full glyphs, without changing the layout", () => {
    const r = rule(".hero-copy h1 em .w");
    expect(r).toMatch(/background-clip:text/);
    // padding makes room for ascenders / slanted tails; the equal negative margin cancels its effect on layout
    const pad = r.match(/padding:([^;]+);/)?.[1].trim().split(/\s+/), mar = r.match(/margin:([^;]+);/)?.[1].trim().split(/\s+/);
    expect(pad?.length).toBe(4);
    expect(mar).toEqual(pad!.map((v) => "-" + v));
    expect(parseFloat(pad![0])).toBeGreaterThanOrEqual(0.15); // top: Fraunces italic ascenders
    expect(parseFloat(pad![1])).toBeGreaterThanOrEqual(0.12); // right: italic slant
    // the headline itself never clips its content
    expect(rule(".hero-copy h1")).not.toMatch(/overflow/);
  });

  it("shows 60 unique, locally stored, credited photos: 30 doctors and 30 pieces of equipment", () => {
    const page = read("app/page.tsx"), credits = read("public/images/CREDITS.md");
    expect(page).toContain("<HeroPortraits alt={h.photoAlt} equipmentAlt={h.equipmentAlt} />");
    const files = SLIDES.map((s) => s.src);
    expect(files.length).toBe(60);
    expect(new Set(files).size).toBe(60);
    expect(SLIDES.filter((s) => !s.equipment).length).toBe(30);
    expect(SLIDES.filter((s) => s.equipment).length).toBe(30);
    expect(SLIDES[0].equipment).toBeUndefined(); // the server-rendered first slide is a doctor
    const hashes = new Set<string>();
    for (const f of files) {
      const abs = path.join(__dirname, "..", "public", f);
      expect(fs.existsSync(abs)).toBe(true);
      hashes.add(crypto.createHash("sha1").update(fs.readFileSync(abs)).digest("hex"));
      expect(credits).toContain("| " + f.replace("/images/", "") + " |"); // every shown file is credited
    }
    expect(hashes.size).toBe(60); // no file is a byte-for-byte copy of another
    // the old six portraits are gone from the slideshow
    expect(files.some((f) => /doctor-\d\.(webp|jpg)$|hero-doctor/.test(f))).toBe(false);
    expect(credits).toMatch(/Pexels licence/);
    expect(credits).toMatch(/not MediHome staff and do not endorse/);
  });

  it("has alt text for every kind of equipment in both languages", () => {
    const kinds = new Set(SLIDES.flatMap((s) => (s.equipment ? [s.equipment] : [])));
    for (const lang of ["en", "bn"] as const) {
      const alt = getDictFor(lang).home.equipmentAlt as Record<string, string>;
      for (const k of kinds) expect(alt[k]?.length).toBeGreaterThan(5);
    }
  });

  it("rotates every 5 seconds without blank frames and respects reduced motion and Data Saver", () => {
    const comp = read("components/HeroPortraits.tsx");
    expect(comp).toMatch(/intervalMs = 5_000/);
    expect(comp).toMatch(/buildCycle\(/);
    expect(comp).toMatch(/\.decode\(\)/); // only a fully decoded image is swapped in
    expect(comp).toMatch(/prefers-reduced-motion: reduce/);
    expect(comp).toMatch(/saveData/);
    expect(comp).toMatch(/document\.hidden/);
    expect(comp).toMatch(/clearTimeout/);
    // the outgoing photo fades out on top; the incoming one is never hidden
    expect(rule(".hero-photo img.pf-out")).toMatch(/animation:pf-out/);
    expect(css).toMatch(/@keyframes pf-settle\{from\{transform:scale\(1\.04\)/);
    expect(css).not.toMatch(/@keyframes pf-settle\{from\{[^}]*opacity/);
  });
});

describe("hero shuffle bag", () => {
  const all = SLIDES.map((_, i) => i);
  const isEq = (i: number) => SLIDES[i].equipment !== undefined;
  // small deterministic PRNG so failures are reproducible
  const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

  it("shows every slide exactly once per cycle", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const c = buildCycle(all, seed % 60, SLIDES, seeded(seed));
      expect(c.length).toBe(60);
      expect([...c].sort((a, b) => a - b)).toEqual(all);
    }
  });

  it("never repeats a slide across the cycle boundary", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const prev = seed % 60;
      expect(buildCycle(all, prev, SLIDES, seeded(seed))[0]).not.toBe(prev);
    }
  });

  it("mixes doctors and equipment throughout each cycle", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const c = buildCycle(all, null, SLIDES, seeded(seed));
      // both kinds appear in every quarter of the cycle
      for (let q = 0; q < 4; q++) {
        const part = c.slice(q * 15, q * 15 + 15);
        expect(part.some(isEq)).toBe(true);
        expect(part.some((i) => !isEq(i))).toBe(true);
      }
      // no long runs of one kind (at most two in a row, plus a short tail once one kind has run out)
      let run = 1, longest = 1;
      for (let i = 1; i < c.length; i++) { run = isEq(c[i]) === isEq(c[i - 1]) ? run + 1 : 1; longest = Math.max(longest, run); }
      expect(longest).toBeLessThanOrEqual(6);
      // while both kinds still have slides left, never more than two of one kind in a row
      let eqLeft = 30, docLeft = 30; run = 0;
      for (let i = 0; i < c.length && eqLeft > 0 && docLeft > 0; i++) {
        run = i && isEq(c[i]) === isEq(c[i - 1]) ? run + 1 : 1;
        expect(run).toBeLessThanOrEqual(2);
        if (isEq(c[i])) eqLeft--; else docLeft--;
      }
    }
  });

  it("produces a different order each cycle, not a fixed or alternating pattern", () => {
    const orders = new Set(Array.from({ length: 50 }, (_, s) => buildCycle(all, null, SLIDES, seeded(s + 1)).join(",")));
    expect(orders.size).toBe(50);
    const c = buildCycle(all, null, SLIDES, seeded(7));
    const alternating = c.every((x, i) => i === 0 || isEq(x) !== isEq(c[i - 1]));
    expect(alternating).toBe(false);
  });

  it("first cycle can start from the server-rendered slide without repeating it", () => {
    const rest = buildCycle(all.filter((i) => i !== 0), 0, SLIDES, seeded(3));
    expect(rest.length).toBe(59);
    expect(rest.includes(0)).toBe(false);
  });
});
