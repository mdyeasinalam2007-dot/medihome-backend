import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { renderToString } from "react-dom/server";

// Minimal stand-ins for the Next.js runtime so components can be rendered to HTML in tests.
let cookieLang: string | undefined;
vi.mock("next/headers", () => ({ cookies: () => ({ get: (k: string) => (k === "mh_lang" && cookieLang ? { value: cookieLang } : undefined) }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/doctors" }));
const q = vi.hoisted(() => ({ listDoctors: vi.fn(async () => [] as any[]) }));
vi.mock("@/lib/queries", () => q);

import { SessionProvider } from "next-auth/react";
import Home from "../app/page";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Providers from "../components/Providers";
import { I18nProvider } from "../components/I18nProvider";
import { DICTS } from "../lib/i18n/dictionaries";

const src = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
beforeEach(() => { cookieLang = undefined; });

describe("content is visible without JavaScript", () => {
  it("the page wrapper no longer starts at opacity 0", () => {
    const html = renderToString(<Providers lang="en"><p>hello</p></Providers>);
    expect(html).toContain("hello");
    expect(html).not.toMatch(/opacity:\s*0/);
    expect(src("components/Providers.tsx")).not.toContain("framer-motion");
  });
  it("the CSS entrance effect never changes opacity", () => {
    const css = src("app/globals.css");
    const kf = css.match(/@keyframes page-in\{[^}]*\}[^}]*\}/)?.[0] || "";
    expect(kf).toBeTruthy();
    expect(kf).not.toContain("opacity");
  });
});

describe("homepage", () => {
  it("renders in English by default with emergency call, Ratchet, existing links and no demo label", async () => {
    const html = renderToString(await Home());
    expect(html).toContain('href="tel:999"');
    expect(html).toContain("Ratchet");
    expect(html).not.toMatch(/demo/i);
    expect(html).toContain('action="/doctors"');
    expect(html).toContain('href="/doctors?q=Cardio"');
    expect(html).toContain('href="/register?role=hospital"');
    expect(html).toContain('href="/assistant"');
  });
  it("renders in Bangla when the cookie says bn, keeping the same URLs", async () => {
    cookieLang = "bn";
    const html = renderToString(await Home());
    expect(html).toContain(DICTS.bn.home.servicesTitle);
    expect(html).not.toContain("ডেমো");
    expect(html).toContain('href="/doctors?q=Cardio"');
    expect(html).toContain('action="/doctors"');
  });
  it("ignores an invalid cookie value", async () => {
    cookieLang = "<script>";
    expect(renderToString(await Home())).toContain(DICTS.en.home.servicesTitle);
  });
});

describe("navigation", () => {
  const nav = (lang: "en" | "bn") => renderToString(<SessionProvider session={null}><I18nProvider lang={lang}><Nav /></I18nProvider></SessionProvider>);
  it("marks the current page, offers 999 and an accessible closed menu button", () => {
    const html = nav("en");
    const doctorsLink = html.match(/<a[^>]*href="\/doctors"[^>]*>/)?.[0] || "";
    expect(doctorsLink).toContain('aria-current="page"');
    expect(html.match(/<a[^>]*href="\/beds"[^>]*>/)?.[0]).not.toContain("aria-current");
    expect(html).toContain('href="tel:999"');
    expect(html).toMatch(/aria-expanded="false"/);
    expect(html).toContain('href="#main"'); // skip link
    expect(html).toContain('href="/register"'); // "Get started" for visitors
    expect(html).toMatch(/aria-controls="portal-drawer"/);
  });
  it("shows the language switch with the current language pressed", () => {
    const html = nav("bn");
    expect(html).toContain(DICTS.bn.nav.doctors);
    expect(html).toMatch(/lang="bn" aria-pressed="true"/);
    expect(html).toMatch(/lang="en" aria-pressed="false"/);
  });
});

describe("footer", () => {
  it("links to existing pages and shows the disclaimer, with no demo note", () => {
    const html = renderToString(<Footer t={DICTS.en} />);
    for (const href of ["/terms", "/privacy", "/help", "/register?role=hospital", "/doctors", "/assistant", "tel:999"]) expect(html).toContain(`href="${href}"`);
    expect(html).toContain(DICTS.en.footer.disclaimer);
    expect(html).not.toMatch(/demo/i);
  });
});

describe("visual system rules", () => {
  const css = src("app/globals.css");
  it("only two animations start invisible: the dialog backdrop and the short CSS-only hero entrance", () => {
    const starts = [...css.matchAll(/@keyframes ([\w-]+)\{from\{([^}]*)\}/g)].map(([, name, from]) => ({ name, from }));
    expect(starts.length).toBeGreaterThan(5);
    const hidden = starts.filter((k) => /opacity:\s*\.?0+(?![.\d])/.test(k.from)).map((k) => k.name).sort();
    expect(hidden).toEqual(["fade", "hero-rise"]);
    // the hero entrance is pure CSS (runs without JavaScript) and finishes within about one second
    expect(css).toMatch(/\.rise\{animation:hero-rise \.8s/);
    const delays = [...css.matchAll(/\.rise\.d\d\{animation-delay:([\d.]+)s\}/g)].map((m) => +m[1]);
    expect(Math.max(...delays)).toBeLessThan(0.7);
  });
  it("scroll reveal hides content only while JavaScript runs, with a failsafe and a reduced-motion override", () => {
    expect(css).toMatch(/html\.js:not\(\.reveal-all\) \.reveal:not\(\.in\)\{opacity:0/);
    // The override must use the SAME selector as the hiding rule; a weaker selector loses on specificity
    // and would leave reduced-motion users with invisible sections.
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(reduced).toContain("html.js:not(.reveal-all) .reveal:not(.in){opacity:1;transform:none}");
    const layout = src("app/layout.tsx");
    expect(layout).toMatch(/classList\.add\("js"\)/);
    expect(layout).toMatch(/setTimeout\(function\(\)\{if\(!window\.__revealReady\)document\.documentElement\.classList\.add\("reveal-all"\)\},2500\)/);
    expect(src("components/RevealObserver.tsx")).toMatch(/__revealReady = true/);
  });
  it("reduced motion shortens animations to an instant instead of removing their end state", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(block).toMatch(/animation-duration:\.01ms!important/);
    expect(block).toMatch(/transition-duration:\.01ms!important/);
    expect(block).toMatch(/scroll-behavior:auto/);
  });
  it("uses rem for font sizes so the visitor's text-size setting is respected", () => {
    expect(css.match(/font-size:\s*\d+px/g) || []).toEqual([]);
    expect(css.match(/font:\s*\d{3}\s+\d+px/g) || []).toEqual([]);
  });
  it("the language pill is positioned from the server-rendered data-lang (correct before JavaScript)", () => {
    const html = renderToString(<SessionProvider session={null}><I18nProvider lang="bn"><Nav /></I18nProvider></SessionProvider>);
    expect(html).toMatch(/class="lang[^"]*"[^>]*data-lang="bn"/);
    expect(css).toMatch(/\.lang\[data-lang="bn"\]::before\{transform:translateX\(100%\)\}/);
  });
});
