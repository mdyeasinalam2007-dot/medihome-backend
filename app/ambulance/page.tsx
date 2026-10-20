import { listAmbulances } from "@/lib/queries";
import { AMB_FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import AmbulanceDialog from "@/components/AmbulanceDialog";
export const dynamic = "force-dynamic";
export default async function Ambulance({ searchParams }: { searchParams: { q?: string } }) {
  const rows = await listAmbulances(searchParams.q);
  return <><h1>Ambulance</h1><p className="sub">Request a registered ambulance service. For a life-threatening emergency call 999 first.</p><SearchForm q={searchParams.q} placeholder="Type, area or provider" />
    <div className="grid">{rows.length ? rows.map((a) => <div className="card" key={a.id}><div className="row" style={{ marginTop: 0 }}><h3>{a.type}</h3><span className="badge ok">Available</span></div>
      <p>{a.provider.name} · {a.area || a.provider.area}</p>{a.notes && <p>{a.notes}</p>}<p>Fare: ৳{a.baseFare}{a.perKm ? ` + ৳${a.perKm}/km` : ""} (paid directly to provider)</p>
      <div className="row"><span /><AmbulanceDialog id={a.id} title={a.type} provider={a.provider.name} fare={`৳${a.baseFare}${a.perKm ? ` + ৳${a.perKm}/km` : ""}`} fee={AMB_FEE()} /></div></div>)
      : <Empty icon="🚑" title="No Ambulance Services Available Right Now" text="No provider has listed an available ambulance yet. Please check back soon." />}</div></>;
}
