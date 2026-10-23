import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

let cookieLang: string | undefined;
vi.mock("next/headers", () => ({ cookies: () => ({ get: (k: string) => (k === "mh_lang" && cookieLang ? { value: cookieLang } : undefined) }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }), usePathname: () => "/", notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
const q = vi.hoisted(() => ({ listDoctors: vi.fn(), listBlood: vi.fn(), listAccommodations: vi.fn(), getHospital: vi.fn() }));
vi.mock("@/lib/queries", () => q);

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "../components/I18nProvider";
import { DoctorCard, BedCard } from "../components/listing/Cards";
import Doctors from "../app/doctors/page";
import Blood from "../app/blood/page";
import Beds from "../app/beds/page";
import Hospital from "../app/hospitals/[id]/page";
import { DICTS, type Lang } from "../lib/i18n/dictionaries";
import { CATEGORIES } from "../lib/constants";
import { money, has, fill, isBookableDate } from "../lib/format";

const wrap = (lang: Lang, node: React.ReactNode) => renderToString(<SessionProvider session={null}><I18nProvider lang={lang}>{node}</I18nProvider></SessionProvider>);
const H = { id: "h1", name: "City Hospital", location: "Dhaka" };
beforeEach(() => { cookieLang = undefined; Object.values(q).forEach((f) => f.mockReset()); });

describe("formatting", () => {
  it("uses Bengali digits in Bangla and keeps the Taka sign", () => {
    expect(money("bn", 1500)).toBe("৳১,৫০০");
    expect(money("en", 1500)).toBe("৳1,500");
  });
  it("treats empty and 0 as 'not filled in'", () => {
    for (const v of ["", null, undefined, 0]) expect(has(v)).toBe(false);
    for (const v of ["x", 5]) expect(has(v)).toBe(true);
    expect(fill("{a} of {b}", { a: 1, b: 2 })).toBe("1 of 2");
  });
  it("accepts only real dates from today onwards for bookings", () => {
    const today = "2026-10-22";
    expect(isBookableDate("2026-10-22", today)).toBe(true);
    expect(isBookableDate("2026-10-25", today)).toBe(true);
    expect(isBookableDate("2026-10-21", today)).toBe(false);
    expect(isBookableDate("2020-01-01", today)).toBe(false);
    for (const bad of ["", "2026-1-5", "dddd-dd-dd", "2026/10/25", "2026-13-40x"]) expect(isBookableDate(bad, today), bad).toBe(false);
  });
  it("has a Bangla name for every bed category", () => {
    for (const [k] of CATEGORIES) expect(DICTS.bn.cats[k], k).toMatch(/[ঀ-৿]/);
  });
});

describe("cards hide missing or zero values", () => {
  it("never shows '0 yrs' or '৳0' for a doctor with blank fields", () => {
    const d = { id: "d1", name: "Farabi", specialty: "Jouno", qualification: "", experience: 0, feeBdt: 0, visitingDays: "", visitingHours: "", slots: "", hospitalId: "h1", hospital: H };
    const html = wrap("en", <DoctorCard d={d} t={DICTS.en} lang="en" fee={10} />);
    expect(html).not.toMatch(/0 yrs/);
    expect(html).not.toContain("৳0");
    expect(html).toContain(DICTS.en.list.priceNotListed);
    expect(html).not.toContain("Visiting:");
    expect(html).toContain('href="/hospitals/h1"');
  });
  it("shows filled-in values, in Bangla digits when Bangla is chosen", () => {
    const d = { id: "d2", name: "Dr. Rahman", specialty: "Cardiology", qualification: "MBBS, FCPS", experience: 12, feeBdt: 800, visitingDays: "Sat, Mon", visitingHours: "5-9pm", slots: "17:00", hospitalId: "h1", hospital: H };
    const html = wrap("bn", <DoctorCard d={d} t={DICTS.bn} lang="bn" fee={10} />);
    expect(html).toContain("৳৮০০");
    expect(html).toContain("১২ বছরের অভিজ্ঞতা");
    expect(html).toContain("MBBS, FCPS");
    expect(html).toContain(DICTS.bn.doctors.book);
  });
  it("marks a full bed as unavailable and disables the request button", () => {
    const a = { id: "b1", category: "icu", name: "", unit: "", total: 4, available: 0, pricePerDay: 5000, additionalCharge: 0, deposit: 0, ac: null, sharing: "PRIVATE", attachedBath: false, facilityLevel: "STANDARD", hospitalId: "h1", hospital: H };
    const html = wrap("bn", <BedCard a={a} t={DICTS.bn} lang="bn" fee={10} />);
    expect(html).toContain(DICTS.bn.cats.icu);
    expect(html).toContain(DICTS.bn.beds.full);
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).not.toContain("জামানত"); // deposit 0 hidden
  });
});

describe("listing pages keep their URLs and parameters", () => {
  it("passes ?q= straight to the existing query and shows a result count", async () => {
    q.listDoctors.mockResolvedValue([]);
    const html = wrap("en", await Doctors({ searchParams: { q: " cardio " } }));
    expect(q.listDoctors).toHaveBeenCalledWith("cardio");
    expect(html).toContain('name="q"');
    expect(html).toContain("0 results");
    expect(html).toContain('href="/doctors"'); // clear filters
    expect(html).toContain(DICTS.en.doctors.emptySearchTitle);
  });
  it("keeps ?cat= for beds", async () => {
    q.listAccommodations.mockResolvedValue([]);
    const html = wrap("en", await Beds({ searchParams: { cat: "icu" } }));
    expect(q.listAccommodations).toHaveBeenCalledWith(undefined, "icu");
    expect(html).toContain('name="cat"');
  });
  it("blood group filters use the same ?group= parameter, with + encoded", async () => {
    q.listBlood.mockResolvedValue([]);
    const html = wrap("en", await Blood({ searchParams: { group: "A+" } }));
    expect(q.listBlood).toHaveBeenCalledWith("A+");
    expect(html).toContain('href="/blood?group=A%2B"');
    expect(html.match(/<a[^>]*href="\/blood\?group=A%2B"[^>]*>/)?.[0]).toContain('aria-current="page"');
  });
  it("shows a friendly error (not a crash) when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    q.listDoctors.mockRejectedValue(new Error("db down"));
    cookieLang = "bn";
    const html = wrap("bn", await Doctors({ searchParams: {} }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(DICTS.bn.list.unavailableTitle);
  });
});

describe("hospital detail page", () => {
  it("returns 404 for hospitals the approval-aware query does not return (pending / suspended)", async () => {
    q.getHospital.mockResolvedValue(null);
    await expect(Hospital({ params: { id: "pending1" } })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(q.getHospital).toHaveBeenCalledWith("pending1");
  });
  it("lists only sections that have content, with booking buttons", async () => {
    q.getHospital.mockResolvedValue({ ...H, address: "Road 1", description: "", facilities: "ICU, Pharmacy", emergency: "01700-000000", photoUrl: null, bloodNote: "",
      doctors: [{ id: "d1", name: "Dr. A", specialty: "Medicine", feeBdt: 500, slots: "17:00" }], accommodations: [], tests: [], blood: [], user: null });
    const html = wrap("en", await Hospital({ params: { id: "h1" } }));
    expect(html).toContain('id="doctors"');
    expect(html).not.toContain('id="beds"');
    expect(html).toContain('href="tel:01700000000"');
    expect(html).toContain(">ICU<");
    expect(html).toContain(DICTS.en.doctors.book);
  });
});
