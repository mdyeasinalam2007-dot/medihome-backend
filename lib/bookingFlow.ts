import { db } from "./db";
import { HttpError } from "./guard";

// MediHome booking flow (DEMO MODE: no payment is ever collected).
//
//   DOCTOR / TEST : patient books            -> CONFIRMED (slot reserved at once)
//   BED / BLOOD   : patient requests         -> REQUESTED (hospital must confirm clinical suitability)
//   hospital  confirm   REQUESTED | PAID      -> CONFIRMED   (BLOOD: stock reduced here, never below 0)
//   hospital  reject    REQUESTED | PAID | CONFIRMED -> REJECTED   (held bed released)
//   hospital  complete  CONFIRMED             -> COMPLETED   (bed stays occupied; hospital updates availability on discharge)
//   patient   cancel    AWAITING_PAYMENT | REQUESTED | PAID | CONFIRMED -> CANCELLED (held bed released)
//   patient   pay       AWAITING_PAYMENT (legacy rows only) -> same as a new booking, without any payment
//
// Bed inventory: a BED booking holds one unit from the moment it is requested. The hold is recorded in
// booking.units (= 1). Older BED bookings have units = null: they never reduced availability, so they never release it.

export type Status = "REQUESTED" | "AWAITING_PAYMENT" | "PAID" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "REFUND_PENDING" | "REFUNDED";
export type Actor = "patient" | "hospital";

const RULES: Record<string, { from: Status[]; to: Status }> = {
  "hospital:confirm": { from: ["REQUESTED", "PAID"], to: "CONFIRMED" },
  "hospital:reject": { from: ["REQUESTED", "PAID", "CONFIRMED"], to: "REJECTED" },
  "hospital:complete": { from: ["CONFIRMED"], to: "COMPLETED" },
  "patient:cancel": { from: ["AWAITING_PAYMENT", "REQUESTED", "PAID", "CONFIRMED"], to: "CANCELLED" },
};
export const rule = (actor: Actor, action: string) => RULES[actor + ":" + action] || null;
export function nextStatus(actor: Actor, action: string, from: string): Status | null {
  const r = rule(actor, action);
  return r && r.from.includes(from as Status) ? r.to : null;
}

// Status a brand-new booking starts in.
export const initialStatus = (type: string): Status => (type === "BED" || type === "BLOOD" ? "REQUESTED" : "CONFIRMED");

// These statuses reserve a doctor's slot. Unpaid legacy holds expire after 30 minutes.
export const SLOT_TAKEN: Status[] = ["REQUESTED", "PAID", "CONFIRMED"];
export const doctorSlotWhere = (doctorId: string, startDate: Date, apptTime: string | null, now = Date.now()) => ({
  type: "DOCTOR" as const, itemRef: doctorId, startDate, apptTime,
  OR: [{ status: { in: SLOT_TAKEN } }, { status: "AWAITING_PAYMENT" as const, createdAt: { gt: new Date(now - 30 * 60_000) } }],
});

// Does this booking currently hold a bed unit that must be given back if it is cancelled/rejected?
export const holdsBed = (b: { type: string; units: number | null; status: string }) =>
  b.type === "BED" && (b.units ?? 0) > 0 && (RULES["patient:cancel"].from as string[]).includes(b.status);

type Tx = Pick<typeof db, "accommodation" | "bloodStock" | "booking">;

// Atomically take one bed. Fails (409) instead of ever going below zero.
export async function takeBed(tx: Tx, accommodationId: string, hospitalId: string) {
  const r = await tx.accommodation.updateMany({ where: { id: accommodationId, hospitalId, published: true, available: { gte: 1 } }, data: { available: { decrement: 1 } } });
  if (!r.count) throw new HttpError(409, "No units available any more");
}
// Give a held bed back, never above the listed total.
export async function releaseBed(tx: Tx, accommodationId: string) {
  await tx.accommodation.updateMany({ where: { id: accommodationId, available: { lt: db.accommodation.fields.total } }, data: { available: { increment: 1 } } });
}
// Atomically reduce blood stock. Fails (409) instead of ever going below zero.
export async function takeBlood(tx: Tx, hospitalId: string, group: string, units: number) {
  const r = await tx.bloodStock.updateMany({ where: { hospitalId, group, units: { gte: units } }, data: { units: { decrement: units } } });
  if (!r.count) throw new HttpError(409, "Not enough units in stock");
}

// Guarded status change: only succeeds if the row is still in an allowed "from" status (no double transitions).
export async function moveBooking(tx: Tx, where: { id: string; hospitalId?: string; patientId?: string }, from: Status[], data: any) {
  const r = await tx.booking.updateMany({ where: { ...where, status: { in: from } }, data });
  if (!r.count) throw new HttpError(409, "This booking can't be changed from its current status");
}

// Serializable transactions can be aborted by Postgres when two requests race. Report that as a clean 409.
export async function serializable<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  try { return await db.$transaction(fn, { isolationLevel: "Serializable" }); }
  catch (e: any) { if (e?.code === "P2034") throw new HttpError(409, "Someone else just booked this. Please try again."); throw e; }
}
