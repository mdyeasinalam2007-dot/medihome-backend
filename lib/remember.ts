// "Remember me on this device".
// Every device/browser always has its own session cookie (HttpOnly, SameSite=Lax; Secure on https). This only
// decides how long THAT device stays signed in:
// - remembered: the cookie persists for the normal session length (authOptions.session.maxAge);
// - not remembered: the cookie has no expiry, so it ends when the browser is closed, and the server also ends
//   the session after SHORT_SESSION_MS even if the browser restores old tabs.
// The choice is sent as a non-secret preference cookie (mh_remember=1|0) set by the sign-in page.
export const REMEMBER_COOKIE = "mh_remember";
export const SHORT_SESSION_MS = 12 * 60 * 60 * 1000;

export const wantsRemember = (cookieHeader: string | null | undefined) => !/(?:^|;\s*)mh_remember=0(?:;|$)/.test(cookieHeader || "");
const isSessionToken = (c: string) => /^(__Secure-)?next-auth\.session-token(\.\d+)?=/.test(c.trim());
const isDeletion = (c: string) => /^[^=]+=;/.test(c.trim()) || /max-age=0(?:;|$)/i.test(c) || /expires=thu, 01 jan 1970/i.test(c);
export const stripExpiry = (c: string) => c.split(";").filter((p) => !/^\s*(expires|max-age)=/i.test(p)).join(";");

// Rewrites the session cookie of a NextAuth response into a browser-session cookie when the visitor chose
// not to be remembered. Cookies that sign the visitor OUT are left untouched so logout always works.
export function sessionOnlyCookies(req: Request, res: Response): Response {
  if (wantsRemember(req.headers.get("cookie"))) return res;
  const set = (res.headers as any).getSetCookie?.() as string[] | undefined;
  if (!set?.some(isSessionToken)) return res;
  const headers = new Headers(res.headers); headers.delete("set-cookie");
  for (const c of set) headers.append("set-cookie", isSessionToken(c) && !isDeletion(c) ? stripExpiry(c) : c);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// Browser side: store this device's choice right before signing in (a preference, not a credential).
export function setRememberChoice(remember: boolean) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${REMEMBER_COOKIE}=${remember ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
