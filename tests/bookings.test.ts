import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("@/lib/db", async () => ({ db: (await import("./helpers/fakeDb")).fakeDb, dbConfigError: () => null }));
vi.mock("@/lib/auth", async () => ({ me: async () => (await import("./helpers/fakeDb")).currentUser() }));

import * as F from "./helpers/fakeDb";
import { POST as createBooking } from "../app/api/bookings/route";
import { POST as patientAction } from "../app/api/bookings/[id]/route";
import { PATCH as hospitalAction } from "../app/api/hospital/bookings/[id]/route";
import { POST as ambulanceAction } from "../app/api/ambulance-bookings/[id]/route";
import { nextStatus, initialStatus, holdsBed } from "../lib/bookingFlow";

const book = (body: any) => F.call(createBooking, F.req("/api/bookings", body));
const patientDo = (bookingId: string, action: string) => F.call(patientAction, F.req(`/api/bookings/${bookingId}`, { action }), { id: bookingId });
const hospitalDo = (bookingId: string, action: string) => F.call(hospitalAction, new Request(`http://localhost/api/hospital/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }), { id: bookingId });
const bed = (bedId: string) => F.rows("accommodation").find((a) => a.id === bedId)!;
const booking = (bid: string) => F.rows("booking").find((b) => b.id === bid)!;

beforeEach(() => F.reset());

describe("booking state machine (pure)", () => {
  it("starts doctor/test bookings confirmed and bed/blood as requests", () => {
    expect(initialStatus("DOCTOR")).toBe("CONFIRMED");
    expect(initialStatus("TEST")).toBe("CONFIRMED");
    expect(initialStatus("BED")).toBe("REQUESTED");
    expect(initialStatus("BLOOD")).toBe("REQUESTED");
  });
  it("allows only valid transitions", () => {
    expect(nextStatus("hospital", "confirm", "REQUESTED")).toBe("CONFIRMED");
    expect(nextStatus("hospital", "confirm", "CONFIRMED")).toBeNull();
    expect(nextStatus("hospital", "reject", "CONFIRMED")).toBe("REJECTED");
    expect(nextStatus("hospital", "reject", "CANCELLED")).toBeNull();
    expect(nextStatus("hospital", "complete", "REQUESTED")).toBeNull();
    expect(nextStatus("patient", "cancel", "COMPLETED")).toBeNull();
    expect(nextStatus("patient", "cancel", "REQUESTED")).toBe("CANCELLED");
    expect(nextStatus("patient", "explode", "REQUESTED")).toBeNull();
  });
  it("treats only new-style bed bookings in an active status as holding a bed", () => {
    expect(holdsBed({ type: "BED", units: 1, status: "REQUESTED" })).toBe(true);
    expect(holdsBed({ type: "BED", units: null, status: "CONFIRMED" })).toBe(false); // legacy row: never took a bed
    expect(holdsBed({ type: "BED", units: 1, status: "CANCELLED" })).toBe(false);
    expect(holdsBed({ type: "BLOOD", units: 2, status: "REQUESTED" })).toBe(false);
  });
});

describe("bed availability", () => {
  it("holds a bed on request and never goes below zero", async () => {
    const { h } = F.seedHospital(); const a = F.seedBed(h.id, 1);
    F.signIn(F.patient());
    const first = await book({ type: "BED", hospitalId: h.id, itemId: a.id, days: 2, date: F.tomorrow() });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("REQUESTED");
    expect(first.body.demo).toBe(true);
    expect(bed(a.id).available).toBe(0);
    expect(booking(first.body.bookingId).units).toBe(1);

    F.signIn(F.patient());
    const second = await book({ type: "BED", hospitalId: h.id, itemId: a.id, days: 2, date: F.tomorrow() });
    expect(second.status).toBe(409);
    expect(bed(a.id).available).toBe(0);
    expect(F.rows("booking")).toHaveLength(1);
  });

  it("releases the bed exactly once when the patient cancels", async () => {
    const { h } = F.seedHospital(); const a = F.seedBed(h.id, 1); const p = F.patient(); F.signIn(p);
    const { body } = await book({ type: "BED", hospitalId: h.id, itemId: a.id, days: 1, date: F.tomorrow() });
    expect((await patientDo(body.bookingId, "cancel")).status).toBe(200);
    expect(bed(a.id).available).toBe(1);
    expect((await patientDo(body.bookingId, "cancel")).status).toBe(409);
    expect(bed(a.id).available).toBe(1);
  });

  it("releases the bed once when the hospital rejects, and never above the total", async () => {
    const { h, user } = F.seedHospital(); const a = F.seedBed(h.id, 1, 1); F.signIn(F.patient());
    const { body } = await book({ type: "BED", hospitalId: h.id, itemId: a.id, days: 1, date: F.tomorrow() });
    bed(a.id).available = 1; // hospital manually reset availability meanwhile
    F.signIn(user);
    const r = await hospitalDo(body.bookingId, "reject");
    expect(r.status).toBe(200);
    expect(booking(body.bookingId).status).toBe("REJECTED");
    expect(bed(a.id).available).toBe(1); // capped at total
    expect((await hospitalDo(body.bookingId, "reject")).status).toBe(409);
  });

  it("gives the bed back when the hospital rejects a request", async () => {
    const { h, user } = F.seedHospital(); const a = F.seedBed(h.id, 1, 2); F.signIn(F.patient());
    const { body } = await book({ type: "BED", hospitalId: h.id, itemId: a.id, days: 1, date: F.tomorrow() });
    expect(bed(a.id).available).toBe(0);
    F.signIn(user);
    expect((await hospitalDo(body.bookingId, "reject")).status).toBe(200);
    expect(bed(a.id).available).toBe(1);
  });

  it("does not release beds for legacy bookings that never took one (the old inflation bug)", async () => {
    const { h, user } = F.seedHospital(); const a = F.seedBed(h.id, 3, 5);
    F.rows("booking").push({ id: "legacy1", patientId: "p0", hospitalId: h.id, type: "BED", itemRef: a.id, units: null, status: "CONFIRMED", feeBdt: 10, createdAt: new Date() });
    F.signIn(user);
    expect((await hospitalDo("legacy1", "reject")).status).toBe(200);
    expect(bed(a.id).available).toBe(3);
  });

  it("keeps the bed occupied when the stay is completed", async () => {
    const { h, user } = F.seedHospital(); const a = F.seedBed(h.id, 2); F.signIn(F.patient());
    const { body } = await book({ type: "BED", hospitalId: h.id, itemId: a.id, days: 1, date: F.tomorrow() });
    F.signIn(user);
    expect((await hospitalDo(body.bookingId, "confirm")).status).toBe(200);
    expect((await hospitalDo(body.bookingId, "complete")).status).toBe(200);
    expect(bed(a.id).available).toBe(1);
  });
});

describe("blood stock", () => {
  it("is reduced only when the hospital confirms, never below zero, and rolls back on failure", async () => {
    const { h, user } = F.seedHospital(); F.seedBlood(h.id, "O+", 3);
    F.signIn(F.patient()); const a = await book({ type: "BLOOD", hospitalId: h.id, group: "O+", units: 3 });
    F.signIn(F.patient()); const b = await book({ type: "BLOOD", hospitalId: h.id, group: "O+", units: 2 });
    expect(a.body.status).toBe("REQUESTED"); expect(b.body.status).toBe("REQUESTED");
    const stock = () => F.rows("bloodStock").find((s) => s.group === "O+")!.units;
    expect(stock()).toBe(3);

    F.signIn(user);
    expect((await hospitalDo(a.body.bookingId, "confirm")).status).toBe(200);
    expect(stock()).toBe(0);
    const fail = await hospitalDo(b.body.bookingId, "confirm");
    expect(fail.status).toBe(409);
    expect(stock()).toBe(0);
    expect(booking(b.body.bookingId).status).toBe("REQUESTED"); // status change rolled back with the failed stock update
  });
});

describe("doctor appointments", () => {
  it("are confirmed at once and cannot be double-booked", async () => {
    const { h, user } = F.seedHospital(); const d = F.seedDoctor(h.id);
    const slot = { type: "DOCTOR", hospitalId: h.id, itemId: d.id, date: F.tomorrow(), time: "17:00" };
    F.signIn(F.patient()); const first = await book(slot);
    expect(first.body.status).toBe("CONFIRMED");
    F.signIn(F.patient()); expect((await book(slot)).status).toBe(409);

    F.signIn(user); // hospital rejects -> the slot is free again
    expect((await hospitalDo(first.body.bookingId, "confirm")).status).toBe(409); // already confirmed
    expect((await hospitalDo(first.body.bookingId, "reject")).status).toBe(200);
    F.signIn(F.patient()); expect((await book(slot)).body.status).toBe("CONFIRMED");
  });

  it("rejects slots that are not offered", async () => {
    const { h } = F.seedHospital(); const d = F.seedDoctor(h.id); F.signIn(F.patient());
    expect((await book({ type: "DOCTOR", hospitalId: h.id, itemId: d.id, date: F.tomorrow(), time: "03:00" })).status).toBe(400);
  });
});

describe("hospital approval in the booking flow", () => {
  it("does not accept bookings for a pending hospital", async () => {
    const { h } = F.seedHospital({ subStatus: "PENDING_VERIFICATION", subExpiresAt: null }); const d = F.seedDoctor(h.id); F.signIn(F.patient());
    expect((await book({ type: "DOCTOR", hospitalId: h.id, itemId: d.id, date: F.tomorrow(), time: "17:00" })).status).toBe(404);
  });
  it("does not let an expired hospital confirm requests", async () => {
    const { h, user } = F.seedHospital(); const a = F.seedBed(h.id, 1); F.signIn(F.patient());
    const { body } = await book({ type: "BED", hospitalId: h.id, itemId: a.id, days: 1, date: F.tomorrow() });
    F.rows("hospital")[0].subExpiresAt = F.future(-1);
    F.signIn(user);
    expect((await hospitalDo(body.bookingId, "confirm")).status).toBe(402);
  });
});

describe("legacy AWAITING_PAYMENT bookings (demo 'pay')", () => {
  it("move into the normal flow without payment and take a bed atomically", async () => {
    const { h } = F.seedHospital(); const a = F.seedBed(h.id, 1); const p = F.patient(); F.signIn(p);
    F.rows("booking").push({ id: "old1", patientId: p.id, hospitalId: h.id, type: "BED", itemRef: a.id, units: null, status: "AWAITING_PAYMENT", feeBdt: 10, createdAt: new Date() });
    const r = await patientDo("old1", "pay");
    expect(r.status).toBe(200); expect(r.body.demo).toBe(true);
    expect(booking("old1").status).toBe("REQUESTED"); expect(booking("old1").units).toBe(1);
    expect(bed(a.id).available).toBe(0);
    expect((await patientDo("old1", "pay")).status).toBe(409);
  });
});

describe("ambulance demo confirmation", () => {
  it("confirms only an accepted request, once, without any payment", async () => {
    const p = F.patient(); F.signIn(p);
    F.rows("ambulanceProvider").push({ id: "prov1", userId: "provUser" });
    F.rows("ambulanceBooking").push({ id: "amb1", patientId: p.id, providerId: "prov1", status: "PENDING", feeBdt: 10 });
    const doIt = (action: string) => F.call(ambulanceAction, F.req("/api/ambulance-bookings/amb1", { action }), { id: "amb1" });
    // fake include: attach provider
    const orig = F.fakeDb.ambulanceBooking.findUnique;
    F.fakeDb.ambulanceBooking.findUnique = async (a: any) => { const r = await orig(a); return r && { ...r, provider: F.rows("ambulanceProvider").find((x) => x.id === r.providerId) }; };
    try {
      expect((await doIt("pay")).status).toBe(409); // not accepted yet
      F.rows("ambulanceBooking")[0].status = "ACCEPTED";
      const ok = await doIt("pay");
      expect(ok.status).toBe(200); expect(ok.body.status).toBe("CONFIRMED"); expect(ok.body.demo).toBe(true);
      expect((await doIt("pay")).status).toBe(409);
      expect((await doIt("cancel")).status).toBe(200);
      expect(F.rows("ambulanceBooking")[0].refundPending).toBeUndefined(); // demo: nothing to refund
    } finally { F.fakeDb.ambulanceBooking.findUnique = orig; }
  });
});
