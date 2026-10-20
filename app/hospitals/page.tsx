import Link from "next/link";
import { listHospitals } from "@/lib/queries";
import Empty, { SearchForm } from "@/components/Empty";
export const dynamic = "force-dynamic";
export default async function Hospitals({ searchParams }: { searchParams: { q?: string } }) {
  const rows = await listHospitals(searchParams.q);
  return <><h1>Hospitals</h1><SearchForm q={searchParams.q} placeholder="Hospital name or area" />
    <div className="grid">{rows.length ? rows.map((h) => <Link href={`/hospitals/${h.id}`} className="card" key={h.id}>
      {h.photoUrl && <img src={h.photoUrl} alt="" style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10, marginBottom: 8 }} />}
      <h3>{h.name}</h3><p>{h.location || h.address}</p><p>{h._count.doctors} doctors · {h._count.accommodations} accommodation types · {h._count.tests} tests</p></Link>)
      : <Empty icon="🏥" title="No Hospitals Listed Yet" text="Registered hospitals will appear here once they are active." />}</div></>;
}
