import { listAccommodations } from "@/lib/queries";
import { CATEGORIES } from "@/lib/constants";
import { FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import { PageHead, ResultInfo, Unavailable } from "@/components/listing/Listing";
import { BedCard } from "@/components/listing/Cards";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function Beds({ searchParams }: { searchParams?: { q?: string; cat?: string } }) {
  const lang = getLang(), t = getDictFor(lang), q = searchParams?.q?.trim() || undefined, cat = searchParams?.cat || undefined;
  let rows: any[] = [], failed = false;
  try { rows = await listAccommodations(q, cat); } catch (err: any) { console.error("Failed to load accommodations:", err?.message || err); failed = true; }

  return <>
    <PageHead icon="bed" title={t.beds.title} sub={t.beds.sub} />
    <SearchForm q={q} placeholder={t.beds.placeholder} label={t.list.searchLabel} button={t.list.search}>
      <select name="cat" defaultValue={cat || ""} aria-label={t.beds.category} className="search-select">
        <option value="">{t.beds.allCats}</option>
        {CATEGORIES.map(([k]) => <option key={k} value={k}>{t.cats[k] || k}</option>)}
      </select>
    </SearchForm>
    {failed ? <Unavailable t={t} /> : <>
      <ResultInfo t={t} lang={lang} count={rows.length} q={q} filtered={!!(q || cat)} base="/beds" />
      <div className="grid">{rows.length ? rows.map((a) => <BedCard key={a.id} a={a} t={t} lang={lang} fee={FEE()} />)
        : <Empty icon="bed" title={t.beds.emptyTitle} text={t.beds.emptyText} />}</div>
    </>}
  </>;
}
