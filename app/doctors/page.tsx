import { listDoctors } from "@/lib/queries";
import { FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import { PageHead, ResultInfo, Unavailable } from "@/components/listing/Listing";
import { DoctorCard } from "@/components/listing/Cards";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function Doctors({ searchParams }: { searchParams?: { q?: string } }) {
  const lang = getLang(), t = getDictFor(lang), q = searchParams?.q?.trim() || undefined;
  let rows: any[] = [], failed = false;
  try { rows = await listDoctors(q); } catch (err: any) { console.error("Failed to load doctors:", err?.message || err); failed = true; }

  return <>
    <PageHead icon="doctor" title={t.doctors.title} sub={t.doctors.sub} />
    <SearchForm q={q} placeholder={t.doctors.placeholder} label={t.list.searchLabel} button={t.list.search} />
    {failed ? <Unavailable t={t} /> : <>
      <ResultInfo t={t} lang={lang} count={rows.length} q={q} filtered={!!q} base="/doctors" />
      <div className="grid">{rows.length ? rows.map((d) => <DoctorCard key={d.id} d={d} t={t} lang={lang} fee={FEE()} />)
        : <Empty icon="doctor" title={q ? t.doctors.emptySearchTitle : t.doctors.emptyTitle} text={q ? t.doctors.emptySearchText : t.doctors.emptyText} />}</div>
    </>}
  </>;
}
