// Display-only helpers for booking and ambulance statuses (no business rules here: those live in lib/bookingFlow.ts).
export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

const BOOKING_TONE: Record<string, Tone> = {
  REQUESTED: "warn", AWAITING_PAYMENT: "warn", PAID: "warn", CONFIRMED: "ok", COMPLETED: "info",
  REJECTED: "bad", REFUND_PENDING: "bad", CANCELLED: "neutral", REFUNDED: "neutral",
};
const AMB_TONE: Record<string, Tone> = { PENDING: "warn", ACCEPTED: "info", CONFIRMED: "ok", COMPLETED: "info", REJECTED: "bad", CANCELLED: "neutral" };
export const bookingTone = (s: string): Tone => BOOKING_TONE[s] || "neutral";
export const ambTone = (s: string): Tone => AMB_TONE[s] || "neutral";

// Dashboard groups. Dates are calendar dates stored as UTC midnight, so they are compared as YYYY-MM-DD strings.
const WAITING = ["REQUESTED", "PAID", "AWAITING_PAYMENT"];
const CLOSED = ["COMPLETED", "CANCELLED", "REJECTED", "REFUND_PENDING", "REFUNDED"];
export const ymd = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
export function groupBookings<T extends { status: string; startDate: Date | string | null }>(rows: T[], today: string) {
  const upcoming: T[] = [], requests: T[] = [], past: T[] = [];
  for (const b of rows) {
    if (WAITING.includes(b.status)) requests.push(b);
    else if (CLOSED.includes(b.status) || (b.startDate && ymd(b.startDate) < today)) past.push(b);
    else upcoming.push(b); // CONFIRMED, today or later (or no date)
  }
  const byDate = (a: T, b: T) => ymd(a.startDate).localeCompare(ymd(b.startDate));
  return { upcoming: upcoming.sort(byDate), requests, past };
}
export const ambulanceActive = (s: string) => ["PENDING", "ACCEPTED", "CONFIRMED"].includes(s);

// Progress steps for the booking page. "stop" marks where a booking ended early (cancelled / declined).
export type Step = { key: "booked" | "requested" | "confirmed" | "completed" | "cancelled" | "declined"; state: "done" | "now" | "todo" | "stop" };
export function timeline(type: string, status: string): Step[] {
  const first: Step["key"] = type === "BED" || type === "BLOOD" ? "requested" : "booked";
  const keys: Step["key"][] = [first, "confirmed", "completed"];
  const reached = status === "COMPLETED" ? 2 : status === "CONFIRMED" ? 1 : 0;
  const steps: Step[] = keys.map((key, i) => ({ key, state: i < reached ? "done" : i === reached ? "now" : "todo" }));
  if (status === "COMPLETED") steps[2].state = "done";
  if (["CANCELLED", "REJECTED", "REFUND_PENDING", "REFUNDED"].includes(status)) {
    const end: Step["key"] = status === "CANCELLED" ? "cancelled" : "declined";
    const kept = steps.slice(0, reached + 1).map((s) => ({ ...s, state: "done" as const }));
    return [...kept, { key: end, state: "stop" }];
  }
  return steps;
}
