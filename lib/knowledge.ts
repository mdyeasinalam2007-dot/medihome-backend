import fs from "fs";
import path from "path";
// Local reference library: drop .md files into /knowledge (see knowledge/README.md). No retraining needed.
export type Ref = { title: string; url: string; retrievedAt: string; licence: string };
const tok = (s: string) => (String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 2);

function parse(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/); if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {}; m[1].split("\n").forEach((l) => { const i = l.indexOf(":"); if (i > 0) meta[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); });
  return { meta, body: m[2] };
}
export function searchKnowledge(query: string, limit = 3, dir = path.join(process.cwd(), "knowledge")): { text: string; ref: Ref }[] {
  let files: string[] = []; try { files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".md") && f.toLowerCase() !== "readme.md"); } catch { return []; }
  const q = new Set(tok(query)); if (!q.size) return [];
  const out: { score: number; text: string; ref: Ref }[] = [];
  for (const f of files) {
    const { meta, body } = parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (!meta.title || !/^https?:\/\//.test(meta.url || "") || !meta.retrieved_at) continue; // no URL / date = not a verifiable source: skipped
    const ref: Ref = { title: meta.title, url: meta.url, retrievedAt: meta.retrieved_at, licence: meta.licence || "unspecified" };
    for (const p of body.split(/\n\s*\n/).map((x) => x.trim()).filter((x) => x.length > 40)) {
      const hits = new Set(tok(p).filter((w) => q.has(w))).size;
      if (hits >= 2) out.push({ score: hits / Math.sqrt(tok(p).length + 1), text: p.slice(0, 1200), ref });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map(({ text, ref }) => ({ text, ref }));
}
