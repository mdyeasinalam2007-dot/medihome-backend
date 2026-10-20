import { listAccommodations } from "@/lib/queries";
import { CATEGORIES, catLabel } from "@/lib/constants";
import { FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import BookDialog from "@/components/BookDialog";
export const dynamic = "force-dynamic";
export default async function Beds({ searchParams }: { searchParams: { q?: string; cat?: string } }) {
  const rows = await listAccommodations(searchParams.q, searchParams.cat);
  return <><h1>Beds & Accommodation</h1>
    <SearchForm q={searchParams.q} placeholder="Hospital or area"><select name="cat" defaultValue={searchParams.cat || ""} aria-label="Category" style={{ width: 200 }}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}</select></SearchForm>
    <div className="grid">{rows.length ? rows.map((a) => <div className="card" key={a.id}>
      <div className="row" style={{ marginTop: 0 }}><h3>{catLabel(a.category)}</h3><span className={"badge " + (a.available > 0 ? "ok" : "bad")}>{a.available > 0 ? `${a.available} of ${a.total} available` : "Full"}</span></div>
      <p>{a.hospital.name}{a.unit && ` · ${a.unit}`}</p>{a.name && <p>{a.name}</p>}
      <p>{a.ac === true ? "AC" : a.ac === false ? "Non-AC" : ""} {a.sharing === "SHARED" ? "· Shared" : "· Private"} {a.attachedBath ? "· Attached bath" : ""} · {a.facilityLevel.toLowerCase()}</p>
      {a.equipment && <p>{a.equipment}</p>}{a.notes && <p>Note: {a.notes}</p>}{a.deposit > 0 && <p>Refundable deposit: ৳{a.deposit}</p>}
      <p style={{ fontSize: 11 }}>Updated {a.updatedAt.toLocaleDateString()}</p>
      <div className="row"><b>৳{a.pricePerDay}/day</b><BookDialog type="BED" label="Request" hospitalId={a.hospital.id} itemId={a.id} title={catLabel(a.category)} hospital={a.hospital.name} fee={FEE()} disabled={a.available < 1} bed={{ pricePerDay: a.pricePerDay, additional: a.additionalCharge, deposit: a.deposit }} /></div></div>)
      : <Empty icon="🛏️" title="No Beds Available Right Now" text="No hospital has published matching accommodation. Change filters or check back later." />}</div></>;
}
