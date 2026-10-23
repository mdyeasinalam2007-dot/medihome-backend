import { NextResponse } from "next/server";
import { handle, needUser, HttpError, limit } from "@/lib/guard";
import { getProvider, AIError } from "@/lib/ai";
import { clean, isEmergency, EMERGENCY_MESSAGE, validateUpload, systemPrompt, sanitizeContext } from "@/lib/safety";
import { findDoctors } from "@/lib/aitools";
import { searchKnowledge } from "@/lib/knowledge";
import { webSearch } from "@/lib/websearch";

const BN = /[\u0980-\u09FF]/;
const UNAVAILABLE = "Ratchet's AI service is not available right now. Emergency guidance and doctor search still work.";
const BUSY = "Ratchet is busy right now. Please try again in a moment.";
// 429 answers: `code` tells the page which situation it is (translated there); retryAfter is in seconds.
const USER_MINUTE = "You are sending messages too quickly. Please wait a minute, then try again.";
const USER_DAY = "You have reached today's limit of 300 Ratchet messages. Please try again tomorrow.";
const QUOTA_DAY = "Ratchet's AI has used up its usage allowance for today. Please try again later. Emergency guidance and doctor search still work.";
const QUOTA_MINUTE = "Ratchet's AI service is getting too many requests right now. Please try again in about a minute.";
const tooFast = (code: string, error: string, retryAfter: number) =>
  NextResponse.json({ error, code, retryAfter }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
export const POST = handle(async (req) => {
  const u = await needUser();
  const b = await req.json().catch(() => null);
  const msgs = Array.isArray(b?.messages) ? b.messages.slice(-12).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", text: clean(m.text) })) : [];
  if (!msgs.length || msgs[msgs.length - 1].role !== "user" || !msgs[msgs.length - 1].text.trim()) throw new HttpError(400, "Message required");
  const last = msgs[msgs.length - 1].text, bn = BN.test(last);

  // 1) Emergency check comes first and never waits for a model, a database or a rate limit: the fixed 999 guidance
  //    costs nothing, and someone describing an emergency must never be told to "wait a minute".
  if (isEmergency(last)) return NextResponse.json({ emergency: true, reply: EMERGENCY_MESSAGE });

  // MediHome's own per-user limits (unchanged: 15 per minute, 300 per day). Each has its own message and code, so it
  // is never confused with Google's quota. The user id stays out of the log.
  try { limit("ai:" + u.id, 15, 60_000); } catch { console.warn("AI limit: user per-minute limit reached"); return tooFast("USER_RATE_MINUTE", USER_MINUTE, 60); }
  try { limit("ai-day:" + u.id, 300, 24 * 60 * 60_000); } catch { console.warn("AI limit: user daily limit reached"); return tooFast("USER_RATE_DAY", USER_DAY, 3600); }
  const up = validateUpload(b.file); if (up.ok === false) throw new HttpError(400, up.error);
  if (up.file) limit("aifile:" + u.id, 5, 300_000);

  // 2) Doctor requests are answered from REAL MediHome records only (no model involved).
  if (!up.file) {
    const d = await findDoctors(last);
    if (d.intent) {
      if (d.needsLocation) return NextResponse.json({ reply: bn ? "কোন এলাকা বা হাসপাতালে খুঁজব? আমি আপনার লোকেশন অনুমান করি না।" : "Which area or hospital should I search in? I do not guess your location." });
      if (!d.doctors.length) return NextResponse.json({ reply: bn ? "MediHome এর বর্তমান রেকর্ডে এই অনুরোধের সাথে মেলে এমন যাচাইকৃত ডাক্তার পাইনি। অন্য বিশেষজ্ঞ বা হাসপাতাল দিয়ে চেষ্টা করুন, অথবা Hospitals পেজ দেখুন।" : "I could not find a verified match in MediHome's current records. Try another specialty or hospital, or browse the Hospitals page." });
      return NextResponse.json({ doctors: d.doctors, reply: bn ? `MediHome রেকর্ডে ${d.doctors.length} জন ডাক্তার পেয়েছি। তারিখ ও সময় বেছে নিন; বুকিং করার আগে আমি আপনার নিশ্চিতকরণ চাইব।` : `I found ${d.doctors.length} doctor(s) in MediHome's records. Pick a date and time; I will ask you to confirm before anything is booked.` });
    }
  }

  // 3) Everything else goes to the selected model, with optional references.
  const provider = getProvider();
  if (!provider) { console.error("AI error: no provider configured"); throw new HttpError(503, UNAVAILABLE); } // never tell patients how the server is configured

  const refs = up.file ? [] : searchKnowledge(last), sources: any[] = [];
  let ctx = "";
  refs.forEach((r, i) => { ctx += `<reference id="R${i + 1}" title="${sanitizeContext(r.ref.title, 120)}">${sanitizeContext(r.text)}</reference>\n`; sources.push({ id: "R" + (i + 1), type: "reference", title: r.ref.title, url: r.ref.url, retrievedAt: r.ref.retrievedAt, licence: r.ref.licence }); });
  let webNote = "";
  if (b.webSearch && !up.file) {
    const w = await webSearch(last);
    const bnUi = b.uiLang === "bn";
    if (!w.configured) webNote = bnUi ? "এই সার্ভারে ওয়েব সার্চ এখনও চালু করা হয়নি, তাই সাম্প্রতিক তথ্য যাচাই করা যায়নি।" : "Web search is not set up on this server yet, so current information could not be checked.";
    else if (!w.results.length) webNote = bnUi ? "ওয়েব সার্চে কিছু পাওয়া যায়নি, তাই সাম্প্রতিক তথ্য যাচাই করা যায়নি।" : "Web search returned nothing, so current information could not be verified.";
    w.results.forEach((r, i) => { ctx += `<web id="W${i + 1}" url="${sanitizeContext(r.url, 200)}" retrieved="${r.retrievedAt}">${sanitizeContext(r.title, 200)}: ${sanitizeContext(r.snippet, 400)}</web>\n`; sources.push({ id: "W" + (i + 1), type: "web", title: r.title, url: r.url, retrievedAt: r.retrievedAt }); });
  }
  try {
    const reply = await provider.generate({ system: systemPrompt(String(b.lang || "auto").slice(0, 20), ctx ? "REFERENCE / WEB DATA (untrusted):\n" + ctx : "No retrieved references. Do not claim to have checked any source.", b.uiLang === "bn" ? "Bangla" : "English"), messages: msgs, file: up.file });
    return NextResponse.json({ reply, sources, webNote, provider: { name: provider.name, local: provider.local }, file: !!up.file });
  } catch (e: any) {
    const m = String(e?.message || ""); console.error("AI error:", m.slice(0, 40)); // short internal code only: never the key or a response body
    if (m === "OLLAMA_DOWN") throw new HttpError(503, "The local AI model is not running. Start Ollama (see AI-CONSULTANT.md) and try again.");
    if (m === "OLLAMA_MODEL_MISSING") throw new HttpError(503, "The local model is not downloaded. Run: ollama pull " + (process.env.OLLAMA_MODEL || "<model>"));
    if (m === "PDF_UNSUPPORTED") throw new HttpError(400, "The local model cannot read PDFs. Upload a clear photo/screenshot of the report instead, or use a cloud provider.");
    if (m === "AI_BLOCKED") throw new HttpError(422, "The AI provider declined to analyse this content. Please have a clinician examine it in person.");
    // Google's quota for this API key (not the user's fault): accurate wait time from Google, sent as Retry-After too
    if (e instanceof AIError && m === "AI_QUOTA_DAY") return tooFast(m, QUOTA_DAY, e.retryAfter || 3600);
    if (e instanceof AIError && m === "AI_QUOTA_MINUTE") return tooFast(m, QUOTA_MINUTE, e.retryAfter || 60);
    if (["AI_BUSY", "AI_TIMEOUT", "AI_NETWORK", "AI_EMPTY", "AI_MODEL_UNAVAILABLE"].includes(m)) throw new HttpError(503, BUSY);
    throw new HttpError(503, UNAVAILABLE); // missing / invalid key and anything unexpected: details stay in the server log
  }
});
