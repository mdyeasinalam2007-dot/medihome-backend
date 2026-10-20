import { listDoctors } from "@/lib/queries";
import { FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import BookDialog from "@/components/BookDialog";

export const dynamic = "force-dynamic";

export default async function Doctors({ searchParams }: { searchParams?: { q?: string } }) {
  const q = searchParams?.q;
  let rows: any[] = [];
  let dbError: string | null = null;

  try {
    rows = await listDoctors(q);
  } catch (err: any) {
    console.error("Failed to load doctors:", err?.message || err);
    dbError = "Unable to connect to the database. Please try again shortly or check server configuration.";
  }

  return (
    <>
      <h1>Doctors</h1>
      <SearchForm q={q} placeholder="Name, specialty or hospital" />
      <div className="grid">
        {dbError ? (
          <Empty
            icon="⚠️"
            title="Service Temporarily Unavailable"
            text={dbError}
          />
        ) : rows.length ? (
          rows.map((d) => (
            <div className="card" key={d.id}>
              {d.photoUrl ? (
                <img className="av" src={d.photoUrl} alt="" />
              ) : (
                <div className="av">
                  {d.name ? d.name.replace(/^Dr\.?\s*/i, "")[0] || d.name[0] || "D" : "D"}
                </div>
              )}
              <h3>{d.name}</h3>
              <p>
                {d.specialty}
                {d.qualification && ` · ${d.qualification}`}
              </p>
              {d.experience != null && <p>{d.experience} yrs experience</p>}
              <p>
                {d.hospital?.name || "Hospital"} · {d.visitingDays || ""} {d.visitingHours || ""}
              </p>
              <div className="row">
                <b>৳{d.feeBdt}</b>
                <BookDialog
                  type="DOCTOR"
                  hospitalId={d.hospital?.id || d.hospitalId || ""}
                  itemId={d.id}
                  title={d.name}
                  hospital={d.hospital?.name || "Hospital"}
                  fee={FEE()}
                  price={d.feeBdt}
                  slots={(d.slots || "")
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean)}
                />
              </div>
            </div>
          ))
        ) : (
          <Empty
            icon="🩺"
            title={q ? "No matching doctors" : "No Doctors Available Right Now"}
            text={
              q
                ? "Try a different search."
                : "Registered hospitals haven't published doctors yet. Please check back soon."
            }
          />
        )}
      </div>
    </>
  );
}
