import { HttpError } from "./guard";
// Whitelisted, typed fields per hospital resource. s=string n=number b=boolean bn=nullable boolean; "?" = optional
export const RES: Record<string, { model: string; f: Record<string, string> }> = {
  doctors: { model: "doctor", f: { name: "s", photoUrl: "s?", specialty: "s", qualification: "s?", experience: "n?", feeBdt: "n", visitingDays: "s?", visitingHours: "s?", slots: "s?", published: "b?" } },
  accommodations: { model: "accommodation", f: { category: "s", name: "s?", unit: "s?", total: "n", available: "n", pricePerDay: "n", additionalCharge: "n?", deposit: "n?", ac: "bn?", sharing: "s?", occupants: "n?", attachedBath: "b?", facilityLevel: "s?", equipment: "s?", notes: "s?", published: "b?" } },
  tests: { model: "diagnosticTest", f: { name: "s", category: "s?", priceBdt: "n", preparation: "s?", availableDays: "s?", slots: "s?", collection: "s?", reportTime: "s?", published: "b?" } },
};
export const PROFILE_FIELDS = { name: "s", contactPerson: "s?", phone: "s?", address: "s?", location: "s?", description: "s?", facilities: "s?", photoUrl: "s?", license: "s?", emergency: "s?", bloodNote: "s?" };

export function parse(def: Record<string, string>, b: any) {
  const out: any = {};
  for (const [k, t] of Object.entries(def)) {
    const T = t.replace("?", ""), opt = t.endsWith("?"), v = b?.[k];
    if (v === undefined || v === null || v === "") {
      if (T === "bn" && (v === null || v === "")) { out[k] = null; continue; }
      if (!opt) throw new HttpError(400, `${k} is required`);
      continue;
    }
    if (T === "s") out[k] = String(v).slice(0, k === "photoUrl" ? 400000 : 2000);
    else if (T === "n") { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new HttpError(400, `${k} must be a non-negative number`); out[k] = Math.floor(n); }
    else out[k] = v === true || v === "true";
  }
  if (out.available != null && out.total != null && out.available > out.total) throw new HttpError(400, "Available units cannot exceed total");
  return out;
}
