// Pure helpers: understand "find me a <specialty> at <hospital>" in English and Bangla.
export const ROOTS: Record<string, string[]> = {
  dermatology: ["derm", "skin", "চর্ম", "ত্বক"], cardiology: ["cardio", "heart", "হৃদ", "হার্ট"], neurology: ["neuro", "brain", "স্নায়ু", "মস্তিষ্ক"],
  orthopedics: ["ortho", "bone", "joint", "হাড়", "অর্থো"], pediatrics: ["pediatric", "paediatric", "child specialist", "শিশু"], gynecology: ["gyn", "obstet", "প্রসূতি", "স্ত্রীরোগ", "গাইনি"],
  ent: ["ent", "ear nose", "কান নাক গলা"], ophthalmology: ["ophthal", "eye", "চোখ"], psychiatry: ["psychiat", "mental", "মানসিক"], medicine: ["medicine", "physician", "মেডিসিন"],
  urology: ["urolog"], nephrology: ["nephrolog", "kidney", "কিডনি"], endocrinology: ["endocrin", "diabet", "ডায়াবেটিস"], gastroenterology: ["gastro", "liver", "পেটের"], dentistry: ["dentist", "dental", "দাঁত"],
};
const latin = (r: string) => /^[a-z ]+$/i.test(r);
export function rootHit(text: string, root: string): boolean {
  const t = text.toLowerCase();
  if (!latin(root)) return t.includes(root);
  if (root === "ent") return /\bent\b/.test(t);
  return new RegExp("(^|[^a-z])" + root.replace(/ /g, "\\s+")).test(t);
}
export const specialtyMatches = (specialty: string, key: string) => ROOTS[key]?.some((r) => rootHit(specialty, r)) || false;

const STOP = new Set(["hospital", "the", "of", "and", "ltd", "limited"]);
const words = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 2 && !STOP.has(w));
export function hospitalMentioned(text: string, h: { name: string }): boolean {
  const t = text.toLowerCase();
  if (t.includes(h.name.toLowerCase())) return true;
  const tok = words(h.name); if (!tok.length) return false;
  const hit = tok.filter((w) => t.includes(w)).length;
  return hit >= Math.min(2, tok.length) && hit >= Math.ceil(tok.length * 0.6);
}
export function parseDoctorQuery(text: string, hospitals: { id: string; name: string }[]) {
  const keys = Object.keys(ROOTS).filter((k) => ROOTS[k].some((r) => rootHit(text, r)));
  const hs = hospitals.filter((h) => hospitalMentioned(text, h));
  const doctorWord = /doctor|specialist|physician|surgeon|dentist|\w+(ologist|iatrist)|\bdr\b|appointment|serial|ডাক্তার|বিশেষজ্ঞ|অ্যাপয়েন্টমেন্ট|সিরিয়াল/i.test(text);
  const action = /\b(find|show|search|book|list|available|need|looking|want|see|near)\b|খুঁজ|দেখা|বুক|আছে|কাছে|চাই/i.test(text);
  const near = /near me|nearby|around me|কাছে|আশেপাশে/i.test(text);
  return { wants: doctorWord && (action || keys.length > 0 || hs.length > 0), keys, hospitalIds: hs.map((h) => h.id), near, needsLocation: near && hs.length === 0 };
}
