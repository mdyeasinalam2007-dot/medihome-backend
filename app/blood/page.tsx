import { listBlood } from "@/lib/queries";
import { BLOOD_GROUPS } from "@/lib/constants";
import { FEE } from "@/lib/pricing";
import Empty from "@/components/Empty";
import BookDialog from "@/components/BookDialog";

export const dynamic = "force-dynamic";

export default async function Blood({
  searchParams,
}: {
  searchParams?: { group?: string };
}) {
  const group = searchParams?.group;
  let rows: any[] = [];
  let dbError: string | null = null;

  try {
    rows = await listBlood(group);
  } catch (err: any) {
    console.error("Failed to load blood stock:", err?.message || err);
    dbError = "Unable to connect to the database. Please try again shortly.";
  }

  return (
    <>
      <h1>Blood Bank</h1>
      <p className="sub">
        Units are reported by hospitals and may change. Availability does not
        mean a unit is medically suitable for every patient; the hospital
        confirms each request.
      </p>
      <form className="search">
        <select
          name="group"
          defaultValue={group || ""}
          aria-label="Blood group"
        >
          <option value="">All groups</option>
          {BLOOD_GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>
      <div className="grid">
        {dbError ? (
          <Empty
            icon="⚠️"
            title="Service Temporarily Unavailable"
            text={dbError}
          />
        ) : rows.length ? (
          rows.map((s) => (
            <div className="card" key={s.hospitalId + s.group}>
              <h2 style={{ color: "var(--red)" }}>{s.group}</h2>
              <p>
                <b>{s.units}</b> units · {s.hospital?.name || "Hospital"}
              </p>
              <p>{s.hospital?.location || ""}</p>
              {s.hospital?.bloodNote && (
                <p>Requirements: {s.hospital.bloodNote}</p>
              )}
              <p style={{ fontSize: 11 }}>
                Updated{" "}
                {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : ""}
              </p>
              <div className="row">
                <span className="badge ok">Listed</span>
                <BookDialog
                  type="BLOOD"
                  label="Request"
                  hospitalId={s.hospitalId}
                  itemId={s.group}
                  title={`Blood ${s.group}`}
                  hospital={s.hospital?.name || "Hospital"}
                  fee={FEE()}
                  maxUnits={s.units}
                />
              </div>
            </div>
          ))
        ) : (
          <Empty
            icon="🩸"
            title="No Blood Stock Information Available"
            text="No hospital has listed available units for this selection yet."
          />
        )}
      </div>
    </>
  );
}
