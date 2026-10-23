import Link from "next/link";
import { listBlood } from "@/lib/queries";
import { BLOOD_GROUPS } from "@/lib/constants";
import { FEE } from "@/lib/pricing";
import Empty from "@/components/Empty";
import { PageHead, ResultInfo, Unavailable } from "@/components/listing/Listing";
import { BloodCard } from "@/components/listing/Cards";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function Blood({ searchParams }: { searchParams?: { group?: string } }) {
  const lang = getLang(), t = getDictFor(lang), group = searchParams?.group || undefined;
  let rows: any[] = [], failed = false;
  try { rows = await listBlood(group); } catch (err: any) { console.error("Failed to load blood stock:", err?.message || err); failed = true; }

  // Same ?group= URL parameter as before; "+" is encoded as %2B, exactly as the old filter form submitted it.
  return <>
    <PageHead icon="blood" tone="blood" title={t.blood.title} sub={t.blood.sub} />
    <nav className="chip-row" aria-label={t.blood.filterLabel}>
      <Link href="/blood" className={"chip" + (!group ? " on" : "")} aria-current={!group ? "page" : undefined}>{t.blood.allGroups}</Link>
      {BLOOD_GROUPS.map((g) => <Link key={g} href={`/blood?group=${encodeURIComponent(g)}`} className={"chip blood" + (group === g ? " on" : "")} aria-current={group === g ? "page" : undefined}>{g}</Link>)}
    </nav>
    {failed ? <Unavailable t={t} /> : <>
      <ResultInfo t={t} lang={lang} count={rows.length} filtered={!!group} base="/blood" />
      <div className="grid">{rows.length ? rows.map((s) => <BloodCard key={s.hospitalId + s.group} s={s} t={t} lang={lang} fee={FEE()} />)
        : <Empty icon="blood" title={t.blood.emptyTitle} text={t.blood.emptyText} />}</div>
    </>}
  </>;
}
