import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

let cookieLang: string | undefined;
vi.mock("next/headers", () => ({ cookies: () => ({ get: (k: string) => (k === "mh_lang" && cookieLang ? { value: cookieLang } : undefined) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }), usePathname: () => "/",
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, redirect: (u: string) => { throw new Error("NEXT_REDIRECT " + u); },
}));
const m = vi.hoisted(() => ({ me: vi.fn(), booking: { findUnique: vi.fn(), findMany: vi.fn() }, ambulanceBooking: { findMany: vi.fn() }, user: { findUnique: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ me: m.me }));
vi.mock("@/lib/db", () => ({ db: { booking: m.booking, ambulanceBooking: m.ambulanceBooking, user: m.user } }));

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "../components/I18nProvider";
import BookingPage from "../app/bookings/[id]/page";
import Dashboard from "../app/dashboard/page";
import { bookingTone, ambTone, groupBookings, timeline } from "../lib/status";
import { day, dateTime, plural, todayBD } from "../lib/format";
import { apiError } from "../lib/i18n/errors";
import { DICTS, type Lang } from "../lib/i18n/dictionaries";

const wrap = (lang: Lang, node: React.ReactNode) => renderToString(<SessionProvider session={null}><I18nProvider lang={lang}>{node}</I18nProvider></SessionProvider>);
const H = { id: "h1", name: "City Hospital", userId: "hospUser", address: "12 Green Road" };
const booking = (over: any = {}) => ({ id: "cmbooking00000000abcd1234", patientId: "pat1", hospitalId: "h1", hospital: H, type: "DOCTOR", itemName: "Dr. Rahman (Cardiology)",
  status: "CONFIRMED", startDate: new Date("2026-11-03T00:00:00Z"), apptTime: "17:30", days: null, units: null, baseAmount: 800, extraAmount: 0, depositAmount: 0,
  note: null, hospitalNote: null, createdAt: new Date("2026-10-22T04:30:00Z"), payments: [], ...over });
beforeEach(() => { cookieLang = undefined; m.me.mockReset(); Object.values(m.booking).forEach((f) => f.mockReset()); m.ambulanceBooking.findMany.mockReset(); m.user.findUnique.mockReset(); });

describe("status display helpers", () => {
  it("gives every status a tone (and therefore an icon + text, never colour alone)", () => {
    expect(bookingTone("CONFIRMED")).toBe("ok"); expect(bookingTone("REQUESTED")).toBe("warn"); expect(bookingTone("REJECTED")).toBe("bad");
    expect(bookingTone("CANCELLED")).toBe("neutral"); expect(ambTone("PENDING")).toBe("warn"); expect(ambTone("CONFIRMED")).toBe("ok");
    for (const s of Object.keys(DICTS.en.status)) expect(DICTS.bn.status[s], s).toBeTruthy();
    for (const s of Object.keys(DICTS.en.ambStatus)) expect(DICTS.bn.ambStatus[s], s).toBeTruthy();
  });
  it("groups bookings into upcoming / waiting / past using calendar dates", () => {
    const rows = [booking({ id: "a", status: "CONFIRMED", startDate: new Date("2026-10-22T00:00:00Z") }), booking({ id: "b", status: "CONFIRMED", startDate: new Date("2026-10-21T00:00:00Z") }),
      booking({ id: "c", status: "REQUESTED" }), booking({ id: "d", status: "CANCELLED" }), booking({ id: "e", status: "AWAITING_PAYMENT" }), booking({ id: "f", status: "COMPLETED" })];
    const g = groupBookings(rows, "2026-10-22");
    expect(g.upcoming.map((x) => x.id)).toEqual(["a"]);           // today counts as upcoming
    expect(g.requests.map((x) => x.id).sort()).toEqual(["c", "e"]);
    expect(g.past.map((x) => x.id).sort()).toEqual(["b", "d", "f"]); // yesterday's confirmed booking is past
  });
  it("builds the progress timeline, including early endings", () => {
    expect(timeline("DOCTOR", "CONFIRMED").map((s) => s.key + ":" + s.state)).toEqual(["booked:done", "confirmed:now", "completed:todo"]);
    expect(timeline("BED", "REQUESTED")[0]).toEqual({ key: "requested", state: "now" });
    expect(timeline("BED", "REJECTED").map((s) => s.key + ":" + s.state)).toEqual(["requested:done", "declined:stop"]);
    expect(timeline("TEST", "COMPLETED").every((s) => s.state === "done")).toBe(true);
  });
});

describe("dates, plurals and errors", () => {
  it("shows calendar dates exactly as booked (no time-zone shift) and times in Bangladesh time", () => {
    expect(day("en", new Date("2026-11-03T00:00:00Z"))).toBe("Tue, 3 Nov 2026");
    expect(day("bn", new Date("2026-11-03T00:00:00Z"))).toContain("৩");
    expect(dateTime("en", new Date("2026-10-22T04:30:00Z"))).toMatch(/22 Oct 2026.*10:30/); // 04:30 UTC = 10:30 in Dhaka
    expect(dateTime("bn", new Date("2026-10-22T11:30:00Z"))).toContain("১৭:৩০"); // 24-hour clock, no Latin "PM" in Bangla
    expect(dateTime("bn", new Date("2026-10-22T11:30:00Z"))).not.toMatch(/AM|PM/);
    expect(todayBD()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("pluralises in English and keeps Bangla correct", () => {
    expect(plural("en", 1, DICTS.en.plural.unitOne, DICTS.en.plural.unitMany)).toBe("1 unit");
    expect(plural("en", 3, DICTS.en.plural.unitOne, DICTS.en.plural.unitMany)).toBe("3 units");
    expect(plural("bn", 3, DICTS.bn.plural.unitOne, DICTS.bn.plural.unitMany)).toBe("৩ ইউনিট");
  });
  it("translates the API's English errors", () => {
    expect(apiError(DICTS.bn, "bn", "That slot was just taken. Please choose another.")).toBe(DICTS.bn.errs.slotTaken);
    expect(apiError(DICTS.bn, "bn", "This booking can't be changed from its current status")).toBe(DICTS.bn.errs.cannotChange);
    expect(apiError(DICTS.bn, "bn", "Some unknown server message")).toBe(DICTS.bn.acts.failed);
    expect(apiError(DICTS.en, "en", "Some unknown server message")).toBe("Some unknown server message");
  });
});

describe("booking page access control", () => {
  it("sends signed-out visitors to sign in", async () => {
    m.me.mockResolvedValue(null);
    await expect(BookingPage({ params: { id: "x" } })).rejects.toThrow("NEXT_REDIRECT /login");
  });
  it("returns 404 to another patient (and does not reveal the booking)", async () => {
    m.me.mockResolvedValue({ id: "pat2", role: "PATIENT" }); m.booking.findUnique.mockResolvedValue(booking());
    await expect(BookingPage({ params: { id: "cmbooking" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("returns 404 to a different hospital", async () => {
    m.me.mockResolvedValue({ id: "otherHospUser", role: "HOSPITAL" }); m.booking.findUnique.mockResolvedValue(booking());
    await expect(BookingPage({ params: { id: "cmbooking" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("returns 404 for an unknown id", async () => {
    m.me.mockResolvedValue({ id: "pat1", role: "PATIENT" }); m.booking.findUnique.mockResolvedValue(null);
    await expect(BookingPage({ params: { id: "nope" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("shows the owner everything, translated, with actions", async () => {
    cookieLang = "bn"; m.me.mockResolvedValue({ id: "pat1", role: "PATIENT" }); m.booking.findUnique.mockResolvedValue(booking());
    const html = wrap("bn", await BookingPage({ params: { id: "cmbooking" } }));
    expect(html).toContain("1234"); expect(html).toContain(DICTS.bn.status.CONFIRMED);
    expect(html).toContain("12 Green Road");          // address is shown to the patient
    expect(html).toContain("৮০০");                     // Bengali digits
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain(DICTS.bn.acts.cancel);
    expect(html).not.toMatch(/\d+\/\d+\/\d{4}/);       // no US-style dates
  });
  it("shows the booking's own hospital a read-only view without patient actions", async () => {
    m.me.mockResolvedValue({ id: "hospUser", role: "HOSPITAL" }); m.booking.findUnique.mockResolvedValue(booking());
    const html = wrap("en", await BookingPage({ params: { id: "cmbooking" } }));
    expect(html).toContain(DICTS.en.bk.hospitalView);
    expect(html).not.toContain(DICTS.en.acts.cancel);
    expect(html).not.toContain("12 Green Road");
    expect(html).toContain('href="/portal"');
  });
});

describe("patient dashboard", () => {
  it("redirects hospital and ambulance accounts to their portals", async () => {
    m.me.mockResolvedValue({ id: "h", role: "HOSPITAL" }); await expect(Dashboard()).rejects.toThrow("NEXT_REDIRECT /portal");
    m.me.mockResolvedValue({ id: "a", role: "AMBULANCE" }); await expect(Dashboard()).rejects.toThrow("NEXT_REDIRECT /provider");
    m.me.mockResolvedValue(null); await expect(Dashboard()).rejects.toThrow("NEXT_REDIRECT /login");
  });
  it("only queries the signed-in patient's own records and shows them grouped, translated and pluralised", async () => {
    m.me.mockResolvedValue({ id: "pat1", role: "PATIENT" });
    m.user.findUnique.mockResolvedValue({ name: "Rina", phone: "" });
    m.booking.findMany.mockResolvedValue([booking({ id: "b1", type: "BLOOD", itemName: "Blood A+", status: "REQUESTED", units: 1, startDate: null, apptTime: null }),
      booking({ id: "b2", type: "BLOOD", itemName: "Blood O-", status: "REQUESTED", units: 2, startDate: null, apptTime: null })]);
    m.ambulanceBooking.findMany.mockResolvedValue([]);
    const html = wrap("en", await Dashboard());
    expect(m.booking.findMany.mock.calls[0][0].where).toEqual({ patientId: "pat1" });
    expect(m.ambulanceBooking.findMany.mock.calls[0][0].where).toEqual({ patientId: "pat1" });
    expect(html).toContain("Hello, Rina");
    expect(html).toContain("1 unit<"); expect(html).toContain("2 units"); expect(html).not.toContain("1 units");
    expect(html).toContain(DICTS.en.status.REQUESTED);
    expect(html).toContain(DICTS.en.dash.emptyUpcomingT);
    expect(html).toContain(DICTS.en.dash.emptyAmbT);
    expect(html).not.toContain(DICTS.en.dash.payments); // no old payments -> section hidden
  });
  it("shows a friendly error instead of crashing when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.me.mockResolvedValue({ id: "pat1", role: "PATIENT" }); m.user.findUnique.mockRejectedValue(new Error("db down"));
    m.booking.findMany.mockResolvedValue([]); m.ambulanceBooking.findMany.mockResolvedValue([]);
    const html = wrap("bn", await Dashboard());
    expect(html).toContain('role="alert"');
  });
});
