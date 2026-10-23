import type { Lang } from "./i18n/dictionaries";

// Display-only formatting. Bangla uses Bengali digits (০-৯); stored values are never changed.
const locale = (lang: Lang) => (lang === "bn" ? "bn-BD" : "en-IN"); // en-IN = South Asian digit grouping (1,00,000)
export const num = (lang: Lang, n: number) => new Intl.NumberFormat(locale(lang)).format(n);
export const money = (lang: Lang, n: number) => "৳" + num(lang, n);
const dl = (lang: Lang) => (lang === "bn" ? "bn-BD" : "en-GB");
export const TZ = "Asia/Dhaka"; // MediHome serves Bangladesh; servers (e.g. Render) run in UTC
// A moment in time (created / updated / pickup time), shown in Bangladesh time.
export const date = (lang: Lang, d: Date | string) =>
  new Date(d).toLocaleDateString(dl(lang), { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
export const dateTime = (lang: Lang, d: Date | string) =>
  new Date(d).toLocaleString(dl(lang), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });
// A calendar date (appointment / admission day, stored as UTC midnight): shown exactly as booked, no time-zone shift.
export const day = (lang: Lang, d: Date | string) =>
  new Date(d).toLocaleDateString(dl(lang), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
// "1 unit" / "2 units" (English); Bangla uses one form. one/many are dictionary strings with {n}.
export const plural = (lang: Lang, n: number, one: string, many: string) => fill(n === 1 ? one : many, { n: num(lang, n) });
// Today in Bangladesh as YYYY-MM-DD (server side).
export const todayBD = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
// Replace {name} placeholders in a dictionary string.
export const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
// Show a value only when it is meaningful (hides "", null, undefined and 0 where 0 means "not filled in").
export const has = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== 0;
// Today in the visitor's own time zone, as YYYY-MM-DD (for date inputs).
export const localToday = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
// A booking date must be a real YYYY-MM-DD date, today or later. (The server re-checks this too.)
export const isBookableDate = (d: string, today: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + "T00:00:00Z").getTime()) && d >= today;
