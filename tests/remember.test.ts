import { describe, it, expect } from "vitest";
import { sessionOnlyCookies, wantsRemember, stripExpiry } from "../lib/remember";

const res = (cookies: string[]) => { const h = new Headers(); cookies.forEach((c) => h.append("set-cookie", c)); return new Response("{}", { status: 200, headers: h }); };
const req = (cookie: string) => new Request("http://localhost/api/auth/session", { headers: { cookie } });
const TOKEN = "next-auth.session-token=abc; Path=/; Expires=Wed, 21 Oct 2099 07:28:00 GMT; Max-Age=2592000; HttpOnly; SameSite=Lax";

describe("Remember me (per device)", () => {
  it("defaults to remembered when the browser has no preference cookie (previous behaviour)", () => {
    expect(wantsRemember(null)).toBe(true);
    expect(wantsRemember("mh_lang=bn")).toBe(true);
    expect(wantsRemember("mh_remember=1")).toBe(true);
    expect(wantsRemember("a=1; mh_remember=0; b=2")).toBe(false);
  });
  it("keeps the session cookie's expiry when remembered", () => {
    const out = sessionOnlyCookies(req("mh_remember=1"), res([TOKEN]));
    expect((out.headers as any).getSetCookie()[0]).toMatch(/Max-Age=2592000/);
  });
  it("turns the session cookie into a browser-session cookie when not remembered, keeping its security flags", () => {
    const c = (sessionOnlyCookies(req("mh_remember=0"), res([TOKEN, "next-auth.csrf-token=x; Path=/; HttpOnly; SameSite=Lax"])).headers as any).getSetCookie();
    const tok = c.find((x: string) => x.startsWith("next-auth.session-token"));
    expect(tok).not.toMatch(/expires|max-age/i);
    expect(tok).toMatch(/HttpOnly/); expect(tok).toMatch(/SameSite=Lax/); expect(tok).toMatch(/Path=\//);
    expect(c.some((x: string) => x.startsWith("next-auth.csrf-token"))).toBe(true);
  });
  it("never blocks logout: a deleting cookie keeps its Max-Age=0", () => {
    const del = "next-auth.session-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax";
    expect((sessionOnlyCookies(req("mh_remember=0"), res([del])).headers as any).getSetCookie()[0]).toMatch(/Max-Age=0/);
  });
  it("handles secure and chunked cookie names", () => {
    expect(stripExpiry("__Secure-next-auth.session-token.0=a; Path=/; Max-Age=5; Secure")).toBe("__Secure-next-auth.session-token.0=a; Path=/; Secure");
    const c = (sessionOnlyCookies(req("mh_remember=0"), res(["__Secure-next-auth.session-token.1=b; Path=/; Max-Age=9; Secure; HttpOnly"])).headers as any).getSetCookie();
    expect(c[0]).not.toMatch(/max-age/i);
  });
});
