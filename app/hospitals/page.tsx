import Link from "next/link";
import { listHospitals } from "@/lib/queries";
import Empty, { SearchForm } from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function Hospitals({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = searchParams?.q;
  let rows: any[] = [];
  let dbError: string | null = null;

  try {
    rows = await listHospitals(q);
  } catch (err: any) {
    console.error("Failed to load hospitals:", err?.message || err);
    dbError = "Unable to connect to the database. Please try again shortly.";
  }

  return (
    <>
      <h1>Hospitals</h1>
      <SearchForm q={q} placeholder="Hospital name or area" />
      <div className="grid">
        {dbError ? (
          <Empty
            icon="⚠️"
            title="Service Temporarily Unavailable"
            text={dbError}
          />
        ) : rows.length ? (
          rows.map((h) => (
            <Link href={`/hospitals/${h.id}`} className="card" key={h.id}>
              {h.photoUrl && (
                <img
                  src={h.photoUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: 110,
                    objectFit: "cover",
                    borderRadius: 10,
                    marginBottom: 8,
                  }}
                />
              )}
              <h3>{h.name}</h3>
              <p>{h.location || h.address}</p>
              <p>
                {h._count?.doctors || 0} doctors ·{" "}
                {h._count?.accommodations || 0} accommodation types ·{" "}
                {h._count?.tests || 0} tests
              </p>
            </Link>
          ))
        ) : (
          <Empty
            icon="🏥"
            title="No Hospitals Listed Yet"
            text="Registered hospitals will appear here once they are active."
          />
        )}
      </div>
    </>
  );
}
