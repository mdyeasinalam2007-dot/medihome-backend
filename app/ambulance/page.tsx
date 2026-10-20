import { listAmbulances } from "@/lib/queries";
import { AMB_FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import AmbulanceDialog from "@/components/AmbulanceDialog";

export const dynamic = "force-dynamic";

export default async function Ambulance({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = searchParams?.q;
  let rows: any[] = [];
  let dbError: string | null = null;

  try {
    rows = await listAmbulances(q);
  } catch (err: any) {
    console.error("Failed to load ambulances:", err?.message || err);
    dbError = "Unable to connect to the database. Please try again shortly.";
  }

  return (
    <>
      <h1>Ambulance</h1>
      <p className="sub">
        Request a registered ambulance service. For a life-threatening
        emergency call 999 first.
      </p>
      <SearchForm q={q} placeholder="Type, area or provider" />
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
                <h3>{a.type}</h3>
                <span className="badge ok">Available</span>
              </div>
              <p>
                {a.provider?.name || "Provider"} ·{" "}
                {a.area || a.provider?.area || ""}
              </p>
              {a.notes && <p>{a.notes}</p>}
              <p>
                Fare: ৳{a.baseFare}
                {a.perKm ? ` + ৳${a.perKm}/km` : ""} (paid directly to provider)
              </p>
              <div className="row">
                <span />
                <AmbulanceDialog
                  id={a.id}
                  title={a.type}
                  provider={a.provider?.name || "Provider"}
                  fare={`৳${a.baseFare}${a.perKm ? ` + ৳${a.perKm}/km` : ""}`}
                  fee={AMB_FEE()}
                />
              </div>
            </div>
          ))
        ) : (
          <Empty
            icon="🚑"
            title="No Ambulance Services Available Right Now"
            text="No provider has listed an available ambulance yet. Please check back soon."
          />
        )}
      </div>
    </>
  );
}
