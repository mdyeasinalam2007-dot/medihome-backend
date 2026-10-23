import { listAmbulances } from "@/lib/queries";
import Empty, { SearchForm } from "@/components/Empty";
import { PageHead, ResultInfo, Unavailable } from "@/components/listing/Listing";
import { AmbulanceCard } from "@/components/listing/Cards";
import Icon from "@/components/ui/Icon";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function Ambulance({ searchParams }: { searchParams?: { q?: string } }) {
  const lang = getLang(), t = getDictFor(lang), q = searchParams?.q?.trim() || undefined;
  let rows: any[] = [], failed = false;
  try { rows = await listAmbulances(q); } catch (err: any) { console.error("Failed to load ambulances:", err?.message || err); failed = true; }

  return <>
    <PageHead icon="ambulance" title={t.ambulance.title} sub={t.ambulance.sub} />
    <a href="tel:999" className="sos-strip"><Icon name="phone" />{t.nav.call999}</a>
    <SearchForm q={q} placeholder={t.ambulance.placeholder} label={t.list.searchLabel} button={t.list.search} />
    {failed ? <Unavailable t={t} /> : <>
      <ResultInfo t={t} lang={lang} count={rows.length} q={q} filtered={!!q} base="/ambulance" />
      <div className="grid">{rows.length ? rows.map((v) => <AmbulanceCard key={v.id} v={v} t={t} lang={lang} />)
        : <Empty icon="ambulance" title={t.ambulance.emptyTitle} text={t.ambulance.emptyText} />}</div>
    </>}
  </>;
}
