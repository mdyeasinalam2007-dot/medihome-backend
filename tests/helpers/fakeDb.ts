// Minimal in-memory stand-in for the Prisma client, covering only what the tested routes use.
// $transaction(fn) rolls back on error like a real database transaction.
type Row = Record<string, any>;
const MODELS = ["user", "hospital", "doctor", "accommodation", "bloodStock", "booking", "auditLog", "verificationToken", "ambulanceProvider", "ambulance", "ambulanceBooking", "payment", "account", "session"];

let state: Record<string, Row[]> = {};
let seq = 0;
export const id = (p = "id") => `${p}${++seq}`;
export function reset() { state = Object.fromEntries(MODELS.map((m) => [m, []])); }
reset();
export const rows = (model: string) => state[model];

const isFieldRef = (v: any) => v && typeof v === "object" && "__field" in v;
const val = (row: Row, v: any) => (isFieldRef(v) ? row[v.__field] : v);
const cmp = (a: any, b: any) => (a instanceof Date ? a.getTime() : a) - (b instanceof Date ? b.getTime() : b);

function matchField(row: Row, key: string, cond: any): boolean {
  const v = row[key];
  if (cond === null || typeof cond !== "object" || cond instanceof Date) return cond instanceof Date ? v instanceof Date && v.getTime() === cond.getTime() : v === cond;
  if (isFieldRef(cond)) return v === row[cond.__field];
  for (const [op, raw] of Object.entries(cond)) {
    const x = val(row, raw);
    if (op === "in" && !(x as any[]).includes(v)) return false;
    if (op === "not" && (x === null ? v === null : v === x)) return false;
    if (op === "gt" && !(v != null && cmp(v, x) > 0)) return false;
    if (op === "gte" && !(v != null && cmp(v, x) >= 0)) return false;
    if (op === "lt" && !(v != null && cmp(v, x) < 0)) return false;
    if (op === "lte" && !(v != null && cmp(v, x) <= 0)) return false;
    if (op === "contains" && !String(v || "").toLowerCase().includes(String(x).toLowerCase())) return false;
  }
  return true;
}
export function matches(row: Row, where: any = {}): boolean {
  for (const [k, c] of Object.entries(where || {})) {
    if (c === undefined) continue;
    if (k === "OR") { if (!(c as any[]).some((w) => matches(row, w))) return false; continue; }
    if (k === "AND") { if (!(c as any[]).every((w) => matches(row, w))) return false; continue; }
    if (k === "hospitalId_group") { if (row.hospitalId !== (c as any).hospitalId || row.group !== (c as any).group) return false; continue; }
    if (!matchField(row, k, c)) return false;
  }
  return true;
}
function apply(row: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !(v instanceof Date) && ("increment" in v || "decrement" in v)) row[k] = (row[k] || 0) + ((v as any).increment || 0) - ((v as any).decrement || 0);
    else row[k] = v;
  }
  if ("updatedAt" in row) row.updatedAt = new Date();
}
const sortRows = (list: Row[], orderBy: any) => {
  if (!orderBy) return list;
  const [[k, dir]] = Object.entries(orderBy) as [string, string][];
  return [...list].sort((a, b) => (dir === "desc" ? -1 : 1) * cmp(a[k], b[k]));
};

function delegate(model: string) {
  const list = () => state[model];
  return {
    fields: new Proxy({}, { get: (_t, name) => ({ __field: String(name) }) }),
    async findFirst(a: any = {}) { const r = sortRows(list().filter((x) => matches(x, a.where)), a.orderBy)[0]; return r ? { ...r } : null; }, // copies, like Prisma
    async findUnique(a: any = {}) { const r = list().find((x) => matches(x, a.where)); return r ? { ...r } : null; },
    async findMany(a: any = {}) { return sortRows(list().filter((r) => matches(r, a.where)), a.orderBy).slice(0, a.take ?? Infinity).map((r) => ({ ...r })); },
    async count(a: any = {}) { return list().filter((r) => matches(r, a.where)).length; },
    async create(a: any) {
      const { hospital, ambulanceProvider, ...data } = a.data;
      const row: Row = { id: id(model), createdAt: new Date(), ...data };
      list().push(row);
      if (hospital?.create) state.hospital.push({ id: id("hospital"), createdAt: new Date(), ...hospital.create, userId: row.id });
      if (ambulanceProvider?.create) state.ambulanceProvider.push({ id: id("prov"), ...ambulanceProvider.create, userId: row.id });
      return { ...row };
    },
    async update(a: any) { const r = list().find((x) => matches(x, a.where)); if (!r) throw Object.assign(new Error("not found"), { code: "P2025" }); apply(r, a.data); return { ...r }; },
    async updateMany(a: any) { const hit = list().filter((r) => matches(r, a.where)); hit.forEach((r) => apply(r, a.data)); return { count: hit.length }; },
    async deleteMany(a: any = {}) { const keep = list().filter((r) => !matches(r, a.where)); const n = list().length - keep.length; state[model] = keep; return { count: n }; },
    async upsert(a: any) { const r = list().find((x) => matches(x, a.where)); if (r) { apply(r, a.update); return r; } const row = { ...a.create }; list().push(row); return row; },
  };
}

const clone = (s: typeof state) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
export const fakeDb: any = Object.fromEntries(MODELS.map((m) => [m, delegate(m)]));
fakeDb.$transaction = async (arg: any) => {
  const snap = clone(state);
  try { return typeof arg === "function" ? await arg(fakeDb) : await Promise.all(arg); }
  catch (e) { state = snap; throw e; }
};
fakeDb.$queryRaw = async () => [{ "?column?": 1 }];

// ---- the signed-in user, read by the mocked lib/auth me() ----
let current: any = null;
export const signIn = (u: any) => { current = u; };
export const currentUser = () => current;

// ---- request helpers ----
export const req = (url: string, body?: any, headers: Record<string, string> = {}) =>
  new Request("http://localhost" + url, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
export const call = async (handler: any, r: Request, params: any = {}) => { const res: Response = await handler(r, { params }); return { status: res.status, body: await res.json() }; };

// ---- seed helpers ----
const future = (days: number) => new Date(Date.now() + days * 86_400_000);
export function seedHospital(over: Row = {}) {
  const userId = id("huser");
  const h = { id: id("hosp"), userId, name: "Test Hospital", location: "Dhaka", phone: "01700000000", address: "Road 1", subStatus: "ACTIVE", subExpiresAt: future(20), regPaid: true, createdAt: new Date(), ...over };
  state.hospital.push(h);
  return { h, user: { id: userId, role: "HOSPITAL" as const, hospitalId: h.id } };
}
export function seedBed(hospitalId: string, available: number, total = available, over: Row = {}) {
  const a = { id: id("bed"), hospitalId, category: "icu", name: "ICU", total, available, pricePerDay: 1000, additionalCharge: 0, deposit: 0, published: true, ...over };
  state.accommodation.push(a); return a;
}
export function seedDoctor(hospitalId: string, over: Row = {}) {
  const d = { id: id("doc"), hospitalId, name: "Dr. A", specialty: "Medicine", feeBdt: 500, slots: "17:00,17:30", published: true, createdAt: new Date(), ...over };
  state.doctor.push(d); return d;
}
export function seedBlood(hospitalId: string, group: string, units: number) { const s = { hospitalId, group, units }; state.bloodStock.push(s); return s; }
export const patient = () => ({ id: id("pat"), role: "PATIENT" as const });
export const tomorrow = () => future(1).toISOString().slice(0, 10);
export { future };
