import { PageHead } from "./listing/Listing";
import Icon, { type IconName } from "./ui/Icon";

// Shared layout for Help / Terms / Privacy: page banner + readable sections.
export default function InfoPage({ icon, title, sub, note, items }: { icon: IconName; title: string; sub?: string; note?: string; items: { t?: string; s: string }[] }) {
  return <>
    <PageHead icon={icon} title={title} sub={sub} />
    <article className="prose info">
      {note && <p className="banner info">{note}</p>}
      {items.map((x, i) => <section key={i} className="info-sec">{x.t && <h2>{x.t}</h2>}<p>{x.s}</p></section>)}
    </article>
  </>;
}
