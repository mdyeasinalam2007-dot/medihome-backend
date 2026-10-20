import { notFound } from "next/navigation";
import Link from "next/link";
import { getHospital } from "@/lib/queries";
import { catLabel } from "@/lib/constants";
import { AMB_FEE } from "@/lib/pricing";
import AmbulanceDialog from "@/components/AmbulanceDialog";
export const dynamic = "force-dynamic";
export default async function Hospital({ params }: { params: { id: string } }) {
  const h = await getHospital(params.id); if (!h) notFound();
  return <><h1>{h.name}</h1><p className="sub">{h.address}{h.location && `, ${h.location}`}</p>
    {h.description && <p>{h.description}</p>}{h.facilities && <p><b>Facilities:</b> {h.facilities}</p>}{h.emergency && <p><b>Emergency:</b> {h.emergency}</p>}
    <h2 style={{ marginTop: 20 }}>Doctors ({h.doctors.length})</h2><div className="grid">{h.doctors.map((d) => <Link key={d.id} href={`/doctors?q=${encodeURIComponent(d.name)}`} className="card"><h3>{d.name}</h3><p>{d.specialty} · ৳{d.feeBdt}</p></Link>)}</div>
    <h2 style={{ marginTop: 20 }}>Accommodation ({h.accommodations.length})</h2><div className="grid">{h.accommodations.map((a) => <Link key={a.id} href={`/beds?q=${encodeURIComponent(h.name)}`} className="card"><h3>{catLabel(a.category)}</h3><p>৳{a.pricePerDay}/day · {a.available} available</p></Link>)}</div>
    <h2 style={{ marginTop: 20 }}>Tests ({h.tests.length})</h2><div className="grid">{h.tests.map((t) => <div key={t.id} className="card"><h3>{t.name}</h3><p>৳{t.priceBdt}</p></div>)}</div>
    {(h.user?.ambulanceProvider?.vehicles.length || 0) > 0 && <><h2 style={{ marginTop: 20 }}>Ambulance service</h2><div className="grid">{h.user!.ambulanceProvider!.vehicles.map((v) => <div key={v.id} className="card"><h3>{v.type}</h3><p>{v.area} · ৳{v.baseFare}{v.perKm ? ` + ৳${v.perKm}/km` : ""}</p>{v.notes && <p>{v.notes}</p>}<div className="row"><span /><AmbulanceDialog id={v.id} title={v.type} provider={h.name} fare={`৳${v.baseFare}${v.perKm ? ` + ৳${v.perKm}/km` : ""}`} fee={AMB_FEE()} /></div></div>)}</div></>}
    <h2 style={{ marginTop: 20 }}>Blood stock</h2><div className="grid">{h.blood.map((b) => <div key={b.group} className="card"><h3>{b.group}</h3><p>{b.units} units</p></div>)}</div></>;
}
