// Optional live web search through your OWN SearXNG instance (open source, no paid API). Off unless SEARXNG_URL is set.
export type WebHit = { title: string; url: string; snippet: string; retrievedAt: string };
export async function webSearch(q: string): Promise<{ configured: boolean; results: WebHit[]; error?: string }> {
  const base = process.env.SEARXNG_URL; if (!base) return { configured: false, results: [] };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/search?format=json&q=${encodeURIComponent(q.slice(0, 200))}`, { signal: ctl.signal });
    if (!r.ok) return { configured: true, results: [], error: "HTTP " + r.status };
    const j: any = await r.json(), at = new Date().toISOString();
    return { configured: true, results: (j.results || []).filter((x: any) => /^https?:\/\//.test(x.url || "")).slice(0, 5).map((x: any) => ({ title: String(x.title || "").slice(0, 200), url: String(x.url), snippet: String(x.content || "").slice(0, 400), retrievedAt: at })) };
  } catch { return { configured: true, results: [], error: "unreachable" }; } finally { clearTimeout(timer); }
}
