// Splits a heading into words that rise in one after another (CSS only: no JavaScript needed, instant with
// reduced motion). `from` continues the count when a heading is made of several parts. The words stay
// ordinary inline text, so the heading reads normally.
export default function Words({ text, from = 0 }: { text: string; from?: number }) {
  const parts = text.split(/(\s+)/);
  let i = from;
  return <>{parts.map((p, k) => /^\s+$/.test(p) || !p ? p : <span key={k} className="w" style={{ "--w": i++ } as React.CSSProperties}>{p}</span>)}</>;
}
export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
