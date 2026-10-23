import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { renderToString } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }), usePathname: () => "/" }));

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "../components/I18nProvider";
import PortalDrawer, { portalItems } from "../components/PortalDrawer";
import { DICTS } from "../lib/i18n/dictionaries";

const t = DICTS.en;
const hrefs = (role?: string) => portalItems(role ? { role, name: "X" } : null, t).items.map((i) => i[0]);
const render = (user: any) => renderToString(<SessionProvider session={null}><I18nProvider lang="en">
  <PortalDrawer open onClose={() => {}} user={user} t={t} path="/" /></I18nProvider></SessionProvider>);

describe("role-aware portal drawer", () => {
  it("patients get only their own dashboard sections", () => {
    const h = hrefs("PATIENT");
    expect(h.every((x) => x.startsWith("/dashboard"))).toBe(true);
    expect(h).toEqual(expect.arrayContaining(["/dashboard#upcoming", "/dashboard#requests", "/dashboard#ambulance", "/dashboard#profile"]));
  });
  it("hospitals get only their portal tabs (existing tab ids)", () => {
    const h = hrefs("HOSPITAL");
    expect(h.every((x) => x.startsWith("/portal#"))).toBe(true);
    const tabs = h.map((x) => x.split("#")[1]);
    const portal = fs.readFileSync(path.join(__dirname, "..", "components", "Portal.tsx"), "utf8");
    for (const id of tabs) expect(portal, id).toContain(`"${id}"`); // every link opens a tab that exists
  });
  it("ambulance providers get only their portal", () => {
    expect(hrefs("AMBULANCE")).toEqual(["/provider#requests", "/provider#fleet"]);
  });
  it("visitors get no portal links", () => {
    expect(hrefs()).toEqual([]);
    expect(hrefs("SOMETHING_ELSE")).toEqual([]);
  });
  it("never links to the admin page for any role", () => {
    for (const r of ["PATIENT", "HOSPITAL", "AMBULANCE", undefined]) expect(hrefs(r).some((x) => x.startsWith("/owner"))).toBe(false);
    for (const u of [null, { role: "PATIENT", name: "P" }, { role: "HOSPITAL", name: "H" }]) expect(render(u)).not.toContain('href="/owner');
  });
  it("renders an accessible dialog: sign-in options for visitors, sign-out for signed-in users", () => {
    const guest = render(null);
    expect(guest).toMatch(/role="dialog"/); expect(guest).toMatch(/aria-modal="true"/);
    expect(guest).toContain('href="/login"'); expect(guest).toContain('href="/register"');
    expect(guest).not.toContain('href="/dashboard"'); expect(guest).not.toContain(t.drawer.signOut);
    const patient = render({ role: "PATIENT", name: "Rina" });
    expect(patient).toContain("Rina"); expect(patient).toContain(t.drawer.signOut);
    expect(patient).toContain('href="/dashboard"'); expect(patient).not.toContain('href="/portal');
    const hospital = render({ role: "HOSPITAL", name: "City" });
    expect(hospital).toContain('href="/portal"'); expect(hospital).not.toContain('href="/dashboard');
  });
});
