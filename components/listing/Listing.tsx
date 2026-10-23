import Link from "next/link";
import Icon, { type IconName } from "../ui/Icon";
import Empty from "../Empty";
import type { Dict, Lang } from "@/lib/i18n/dictionaries";
import { fill, num } from "@/lib/format";

// Shared building blocks for the listing pages (server components: no JavaScript sent to the browser).
export function PageHead({ icon, title, sub, tone }: { icon: IconName; title: string; sub?: string; tone?: "blood" }) {
  return <header className="page-head">
    <span className={"page-ic" + (tone ? " " + tone : "")}><Icon name={icon} size={26} /></span>
    <div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>
  </header>;
}

// "12 results for “cardio” · Clear filters". The clear link goes back to the plain list URL.
export function ResultInfo({ t, lang, count, q, filtered, base }: { t: Dict; lang: Lang; count: number; q?: string; filtered: boolean; base: string }) {
  return <div className="result-info" aria-live="polite">
    <span>{count === 1 ? t.list.resultOne : fill(t.list.resultMany, { n: num(lang, count) })}{q ? " " + fill(t.list.resultsFor, { q }) : ""}</span>
    {filtered && <Link href={base} className="clear-link"><Icon name="close" size={14} />{t.list.clear}</Link>}
  </div>;
}

export const Unavailable = ({ t }: { t: Dict }) => <Empty icon="alert" tone="error" title={t.list.unavailableTitle} text={t.list.unavailableText} />;
