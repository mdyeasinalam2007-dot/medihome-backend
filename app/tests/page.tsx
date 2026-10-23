import { listTests } from "@/lib/queries";
import { FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import { PageHead, ResultInfo, Unavailable } from "@/components/listing/Listing";
import { TestCard } from "@/components/listing/Cards";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function Tests({ searchParams }: { searchParams?: { q?: string } }) {
  const lang = getLang(), t = getDictFor(lang), q = searchParams?.q?.trim() || undefined;
  let rows: any[] = [], failed = false;
  try { rows = await listTests(q); } catch (err: any) { console.error("Failed to load diagnostic tests:", err?.message || err); failed = true; }

  return <>
    <PageHead icon="test" title={t.tests.title} sub={t.tests.sub} />
    <SearchForm q={q} placeholder={t.tests.placeholder} label={t.list.searchLabel} button={t.list.search} />
    {failed ? <Unavailable t={t} /> : <>
      <ResultInfo t={t} lang={lang} count={rows.length} q={q} filtered={!!q} base="/tests" />
      <div className="grid">{rows.length ? rows.map((x) => <TestCard key={x.id} x={x} t={t} lang={lang} fee={FEE()} />)
        : <Empty icon="test" title={t.tests.emptyTitle} text={t.tests.emptyText} />}</div>
    </>}
  </>;
}
