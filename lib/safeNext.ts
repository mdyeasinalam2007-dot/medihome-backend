// Where to go after signing in. Only same-site paths are accepted ("/bookings/abc"), never another site
// ("https://…", "//evil.example", "/\\evil"), the sign-in page itself, or API routes, so it cannot be used as an
// open redirect. Anything else falls back to /dashboard, which sends each account type to its own portal.
export function safeNext(v: string | null | undefined, fallback = "/dashboard"): string {
  const p = String(v || "");
  if (!/^\/(?![\/\\])[^\s\\]*$/.test(p)) return fallback;
  if (/^\/(login|register|api)(\/|\?|$)/.test(p)) return fallback;
  return p;
}

/** The sign-in URL that brings the visitor back to `path` afterwards. */
export const loginFor = (path: string) => "/login?next=" + encodeURIComponent(safeNext(path));
