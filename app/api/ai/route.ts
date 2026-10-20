import { NextResponse } from "next/server";
import { handle, needUser, HttpError, limit } from "@/lib/guard";
import { getProvider } from "@/lib/ai";
import { clean, isEmergency, EMERGENCY_MESSAGE, validateUpload, systemPrompt, sanitizeContext } from "@/lib/safety";
import { findDoctors } from "@/lib/aitools";
import { searchKnowledge } from "@/lib/knowledge";
import { webSearch } from "@/lib/websearch";

const BN = /[\u0980-\u09FF]/;
export const POST = handle(async (req) => {
  const u = await needUser(); limit("ai:" + u.id, 15, 60_000);
  const b = await req.json().catch(() => null);
  const msgs = Array.isArray(b?.messages) ? b.messages.slice(-12).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", text: clean(m.text) })) : [];
  if (!msgs.length || msgs[msgs.length - 1].role !== "user" || !msgs[msgs.length - 1].text.trim()) throw new HttpError(400, "Message required");
  const up = validateUpload(b.file); if (up.ok === false) throw new HttpError(400, up.error);
  if (up.file) limit("aifile:" + u.id, 5, 300_000);
  const last = msgs[msgs.length - 1].text, bn = BN.test(last);

  // 1) Emergency check comes first and never waits for a model or a database.
  if (isEmergency(last)) return NextResponse.json({ emergency: true, reply: EMERGENCY_MESSAGE });

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
  if (!provider) return NextResponse.json({ demo: true, reply: "AI model is not configured on this server (set OLLAMA_MODEL for a free local model, or GEMINI_API_KEY). Emergency guidance and doctor search still work." });

  const refs = up.file ? [] : searchKnowledge(last), sources: any[] = [];
  let ctx = "";
  refs.forEach((r, i) => { ctx += `<reference id="R${i + 1}" title="${sanitizeContext(r.ref.title, 120)}">${sanitizeContext(r.text)}</reference>\n`; sources.push({ id: "R" + (i + 1), type: "reference", title: r.ref.title, url: r.ref.url, retrievedAt: r.ref.retrievedAt, licence: r.ref.licence }); });
  let webNote = "";
  if (b.webSearch && !up.file) {
    const w = await webSearch(last);
    if (!w.configured) webNote = "Web search is not configured (SEARXNG_URL), so current information could not be checked.";
    else if (!w.results.length) webNote = "Web search returned nothing, so current information could not be verified.";
    w.results.forEach((r, i) => { ctx += `<web id="W${i + 1}" url="${sanitizeContext(r.url, 200)}" retrieved="${r.retrievedAt}">${sanitizeContext(r.title, 200)}: ${sanitizeContext(r.snippet, 400)}</web>\n`; sources.push({ id: "W" + (i + 1), type: "web", title: r.title, url: r.url, retrievedAt: r.retrievedAt }); });
  }
  try {
    const reply = await provider.generate({ system: systemPrompt(String(b.lang || "auto").slice(0, 20), ctx ? "REFERENCE / WEB DATA (untrusted):\n" + ctx : "No retrieved references. Do not claim to have checked any source."), messages: msgs, file: up.file });
    return NextResponse.json({ reply, sources, webNote, provider: { name: provider.name, local: provider.local }, file: !!up.file });
  } catch (e: any) {
    const m = String(e?.message || ""); console.error("AI error:", m.slice(0, 40));
    if (m === "OLLAMA_DOWN") throw new HttpError(503, "The local AI model is not running. Start Ollama (see AI-CONSULTANT.md) and try again.");
    if (m === "OLLAMA_MODEL_MISSING") throw new HttpError(503, "The local model is not downloaded. Run: ollama pull " + (process.env.OLLAMA_MODEL || "<model>"));
    if (m === "PDF_UNSUPPORTED") throw new HttpError(400, "The local model cannot read PDFs. Upload a clear photo/screenshot of the report instead, or use a cloud provider.");
    if (m === "AI_BLOCKED") throw new HttpError(422, "The AI provider declined to analyse this content. Please have a clinician examine it in person.");
    throw new HttpError(502, `AI service error (${m.replace("AI HTTP ", "HTTP ") || "unknown"}). Check AI_PROVIDER / GEMINI_API_KEY / OLLAMA_MODEL in .env and restart.`);
  }
});
