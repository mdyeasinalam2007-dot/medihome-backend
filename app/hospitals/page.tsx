import { listHospitals } from "@/lib/queries";
import Empty, { SearchForm } from "@/components/Empty";
import { PageHead, ResultInfo, Unavailable } from "@/components/listing/Listing";
import { HospitalCard } from "@/components/listing/Cards";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

// listHospitals() returns only approved hospitals with an active subscription (activeWhere) - unchanged.
export default async function Hospitals({ searchParams }: { searchParams?: { q?: string } }) {
  const lang = getLang(), t = getDictFor(lang), q = searchParams?.q?.trim() || undefined;
  let rows: any[] = [], failed = false;
  try { rows = await listHospitals(q); } catch (err: any) { console.error("Failed to load hospitals:", err?.message || err); failed = true; }

  return <>
    <PageHead icon="hospital" title={t.hospitals.title} sub={t.hospitals.sub} />
    <SearchForm q={q} placeholder={t.hospitals.placeholder} label={t.list.searchLabel} button={t.list.search} />
    {failed ? <Unavailable t={t} /> : <>
      <ResultInfo t={t} lang={lang} count={rows.length} q={q} filtered={!!q} base="/hospitals" />
      <div className="grid">{rows.length ? rows.map((h) => <HospitalCard key={h.id} h={h} t={t} lang={lang} />)
        : <Empty icon="hospital" title={t.hospitals.emptyTitle} text={t.hospitals.emptyText} />}</div>
    </>}
  </>;
}
