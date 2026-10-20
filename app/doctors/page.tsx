import { listDoctors } from "@/lib/queries";
import { FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import BookDialog from "@/components/BookDialog";
export const dynamic = "force-dynamic";
export default async function Doctors({ searchParams }: { searchParams: { q?: string } }) {
  const rows = await listDoctors(searchParams.q);
  return <><h1>Doctors</h1><SearchForm q={searchParams.q} placeholder="Name, specialty or hospital" />
    <div className="grid">{rows.length ? rows.map((d) => <div className="card" key={d.id}>
      {d.photoUrl ? <img className="av" src={d.photoUrl} alt="" /> : <div className="av">{d.name.replace(/^Dr\.?\s*/i, "")[0]}</div>}
      <h3>{d.name}</h3><p>{d.specialty}{d.qualification && ` · ${d.qualification}`}</p>{d.experience != null && <p>{d.experience} yrs experience</p>}<p>{d.hospital.name} · {d.visitingDays} {d.visitingHours}</p>
      <div className="row"><b>৳{d.feeBdt}</b><BookDialog type="DOCTOR" hospitalId={d.hospital.id} itemId={d.id} title={d.name} hospital={d.hospital.name} fee={FEE()} price={d.feeBdt} slots={d.slots.split(",").map((s) => s.trim()).filter(Boolean)} /></div></div>)
      : <Empty icon="🩺" title={searchParams.q ? "No matching doctors" : "No Doctors Available Right Now"} text={searchParams.q ? "Try a different search." : "Registered hospitals haven't published doctors yet. Please check back soon."} />}</div></>;
}
