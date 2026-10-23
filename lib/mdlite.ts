// Minimal formatting for AI answers: **bold**, "# headings" (shown bold) and "* " / "- " list markers (shown as "• ").
// Produces plain text segments only. React escapes them, so no HTML or links from the model can be injected.
export type Seg = { s: string; b: boolean };
export function mdSegments(t: string): Seg[] {
  const text = String(t || "").replace(/\r/g, "").replace(/^[ \t]*#{1,6}[ \t]+(.+)$/gm, "**$1**").replace(/^([ \t]*)[*-][ \t]+/gm, "$1• ");
  const out: Seg[] = [], re = /\*\*([^*\n](?:[^*\n]|\*(?!\*))*?)\*\*/g; let i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) { if (m.index > i) out.push({ s: text.slice(i, m.index), b: false }); out.push({ s: m[1], b: true }); i = re.lastIndex; }
  if (i < text.length) out.push({ s: text.slice(i), b: false });
  return out.map((x) => (x.b ? x : { ...x, s: x.s.replace(/\*\*/g, "") })).filter((x) => x.s);
}
export const plainText = (segs: Seg[]) => segs.map((x) => x.s).join("");
