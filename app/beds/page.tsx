import { listAccommodations } from "@/lib/queries";
import { CATEGORIES, catLabel } from "@/lib/constants";
import { FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import BookDialog from "@/components/BookDialog";

export const dynamic = "force-dynamic";

export default async function Beds({
  searchParams,
}: {
  searchParams?: { q?: string; cat?: string };
}) {
  const q = searchParams?.q;
  const cat = searchParams?.cat;
  let rows: any[] = [];
  let dbError: string | null = null;

  try {
    rows = await listAccommodations(q, cat);
  } catch (err: any) {
    console.error("Failed to load accommodations:", err?.message || err);
    dbError = "Unable to connect to the database. Please try again shortly.";
  }

  return (
    <>
      <h1>Beds & Accommodation</h1>
      <SearchForm q={q} placeholder="Hospital or area">
        <select
          name="cat"
          defaultValue={cat || ""}
          aria-label="Category"
          style={{ width: 200 }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c[0]} value={c[0]}>
              {c[1]}
            </option>
          ))}
        </select>
      </SearchForm>
      <div className="grid">
        {dbError ? (
          <Empty
            icon="⚠️"
            title="Service Temporarily Unavailable"
            text={dbError}
          />
        ) : rows.length ? (
          rows.map((a) => (
            <div className="card" key={a.id}>
              <div className="row" style={{ marginTop: 0 }}>
                <h3>{catLabel(a.category)}</h3>
                <span className={"badge " + (a.available > 0 ? "ok" : "bad")}>
                  {a.available > 0
                    ? `${a.available} of ${a.total} available`
                    : "Full"}
                </span>
              </div>
              <p>
                {a.hospital?.name || "Hospital"}
                {a.unit && ` · ${a.unit}`}
              </p>
              {a.name && <p>{a.name}</p>}
              <p>
                {a.ac === true ? "AC" : a.ac === false ? "Non-AC" : ""}{" "}
                {a.sharing === "SHARED" ? "· Shared" : "· Private"}{" "}
                {a.attachedBath ? "· Attached bath" : ""} ·{" "}
                {(a.facilityLevel || "").toLowerCase()}
              </p>
              {a.equipment && <p>{a.equipment}</p>}
              {a.notes && <p>Note: {a.notes}</p>}
              {a.deposit > 0 && <p>Refundable deposit: ৳{a.deposit}</p>}
              <p style={{ fontSize: 11 }}>
                Updated{" "}
                {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : ""}
              </p>
              <div className="row">
                <b>৳{a.pricePerDay}/day</b>
                <BookDialog
                  type="BED"
                  label="Request"
                  hospitalId={a.hospital?.id || a.hospitalId || ""}
                  itemId={a.id}
                  title={catLabel(a.category)}
                  hospital={a.hospital?.name || "Hospital"}
                  fee={FEE()}
                  disabled={a.available < 1}
                  bed={{
                    pricePerDay: a.pricePerDay,
                    additional: a.additionalCharge || 0,
                    deposit: a.deposit || 0,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <Empty
            icon="🛏️"
            title="No Beds Available Right Now"
            text="No hospital has published matching accommodation. Change filters or check back later."
          />
        )}
      </div>
    </>
  );
}
