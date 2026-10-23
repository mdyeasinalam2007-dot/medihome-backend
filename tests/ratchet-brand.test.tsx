import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { renderToString } from "react-dom/server";

let pathname = "/";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }), usePathname: () => pathname }));
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "../components/I18nProvider";
import RatchetFab from "../components/RatchetFab";
import Nav from "../components/Nav";

const wrap = (el: React.ReactNode, lang: "en" | "bn" = "en") => renderToString(<SessionProvider session={null}><I18nProvider lang={lang}>{el}</I18nProvider></SessionProvider>);

describe("floating Ratchet AI button", () => {
  it("links to the Ratchet page with an accessible label and the Ratchet orb", () => {
    for (const p of ["/", "/doctors", "/dashboard", "/portal", "/provider", "/owner", "/help"]) {
      pathname = p; const html = wrap(<RatchetFab />);
      expect(html).toContain('href="/assistant"');
      expect(html).toContain('aria-label="Open Ratchet AI"');
      expect(html).toContain("ai-orb");
    }
  });
  it("is not shown on the Ratchet page itself", () => {
    pathname = "/assistant"; expect(wrap(<RatchetFab />)).toBe(wrap(null));
  });
  it("is translated in Bangla", () => {
    pathname = "/"; expect(wrap(<RatchetFab />, "bn")).toContain('aria-label="Ratchet AI খুলুন"');
  });
  it("respects reduced motion and never hides content (no opacity in its entrance)", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "app/globals.css"), "utf8");
    const kf = css.match(/@keyframes fab-in\{[^}]*\}[^}]*\}/)?.[0] || "";
    expect(kf).not.toMatch(/opacity/);
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{[\s\S]*animation-duration:\.01ms!important/);
  });
});

describe("Ratchet AI menu item", () => {
  it("reads exactly 'Ratchet AI', styled like the other items, with no decorative stars", () => {
    pathname = "/"; const html = wrap(<Nav />);
    const items = [...html.matchAll(/<a class="(l|pill)"[^>]*href="\/assistant"[^>]*>(.*?)<\/a>/g)];
    expect(items.length).toBe(2); // desktop menu + phone menu
    for (const m of items) { expect(m[2]).toBe("Ratchet AI"); expect(m[1]).toMatch(/^(l|pill)$/); }
    expect(html).not.toMatch(/class="[^"]*\bai\b[^"]*"[^>]*href="\/assistant"/);
  });
});
