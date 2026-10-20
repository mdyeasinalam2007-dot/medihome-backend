import { listTests } from "@/lib/queries";
import { FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import BookDialog from "@/components/BookDialog";
export const dynamic = "force-dynamic";
export default async function Tests({ searchParams }: { searchParams: { q?: string } }) {
  const rows = await listTests(searchParams.q);
  return <><h1>Diagnostic Tests</h1><SearchForm q={searchParams.q} placeholder="Test, category or hospital" />
    <div className="grid">{rows.length ? rows.map((t) => <div className="card" key={t.id}><h3>{t.name}</h3><p>{t.hospital.name}{t.category && ` · ${t.category}`}</p>
      {t.preparation && <p>Preparation: {t.preparation}</p>}{t.reportTime && <p>Report: {t.reportTime}</p>}{t.collection.includes("HOME") && <span className="badge">Home collection</span>}
      <div className="row"><b>৳{t.priceBdt}</b><BookDialog type="TEST" hospitalId={t.hospital.id} itemId={t.id} title={t.name} hospital={t.hospital.name} fee={FEE()} price={t.priceBdt} collection={t.collection.split(",")} /></div></div>)
      : <Empty icon="🧪" title="No Diagnostic Tests Available" text="No hospital has published a test menu yet." />}</div></>;
}
