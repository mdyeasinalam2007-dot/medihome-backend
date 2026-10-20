import { listTests } from "@/lib/queries";
import { FEE } from "@/lib/pricing";
import Empty, { SearchForm } from "@/components/Empty";
import BookDialog from "@/components/BookDialog";

export const dynamic = "force-dynamic";

export default async function Tests({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = searchParams?.q;
  let rows: any[] = [];
  let dbError: string | null = null;

  try {
    rows = await listTests(q);
  } catch (err: any) {
    console.error("Failed to load diagnostic tests:", err?.message || err);
    dbError = "Unable to connect to the database. Please try again shortly.";
  }

  return (
    <>
      <h1>Diagnostic Tests</h1>
      <SearchForm q={q} placeholder="Test, category or hospital" />
      <div className="grid">
        {dbError ? (
          <Empty
            icon="⚠️"
            title="Service Temporarily Unavailable"
            text={dbError}
          />
        ) : rows.length ? (
          rows.map((t) => (
            <div className="card" key={t.id}>
              <h3>{t.name}</h3>
              <p>
                {t.hospital?.name || "Hospital"}
                {t.category && ` · ${t.category}`}
              </p>
              {t.preparation && <p>Preparation: {t.preparation}</p>}
              {t.reportTime && <p>Report: {t.reportTime}</p>}
              {(t.collection || "").includes("HOME") && (
                <span className="badge">Home collection</span>
              )}
              <div className="row">
                <b>৳{t.priceBdt}</b>
                <BookDialog
                  type="TEST"
                  hospitalId={t.hospital?.id || t.hospitalId || ""}
                  itemId={t.id}
                  title={t.name}
                  hospital={t.hospital?.name || "Hospital"}
                  fee={FEE()}
                  price={t.priceBdt}
                  collection={(t.collection || "LAB")
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean)}
                />
              </div>
            </div>
          ))
        ) : (
          <Empty
            icon="🧪"
            title="No Diagnostic Tests Available"
            text="No hospital has published a test menu yet."
          />
        )}
      </div>
    </>
  );
}
