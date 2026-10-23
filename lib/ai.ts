// Provider abstraction. AI_PROVIDER = auto | ollama | gemini
//  ollama = LOCAL and free (your own computer). gemini = Google cloud (your key; data leaves your computer).
export type Msg = { role: "user" | "assistant"; text: string };
export type FileIn = { mime: string; base64: string };
export interface AIProvider { name: string; local: boolean; generate(a: { system: string; messages: Msg[]; file?: FileIn }): Promise<string>; }

const ollama: AIProvider = {
  name: "ollama:" + (process.env.OLLAMA_MODEL || ""), local: true,
  async generate({ system, messages, file }) {
    if (file && file.mime === "application/pdf") throw new Error("PDF_UNSUPPORTED");
    const model = file ? process.env.OLLAMA_VISION_MODEL || process.env.OLLAMA_MODEL! : process.env.OLLAMA_MODEL!;
    const msgs: any[] = [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.text }))];
    if (file) msgs[msgs.length - 1].images = [file.base64];
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 180_000);
    try {
      const r = await fetch(`${(process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "")}/api/chat`, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: msgs, stream: false, options: { temperature: 0.3 } }) });
      if (!r.ok) throw new Error(r.status === 404 ? "OLLAMA_MODEL_MISSING" : "AI HTTP " + r.status);
      const t = (await r.json())?.message?.content; if (!t) throw new Error("AI_EMPTY"); return t;
    } catch (e: any) { if (e?.message?.startsWith("OLLAMA_") || e?.message?.startsWith("AI")) throw e; throw new Error("OLLAMA_DOWN"); }
    finally { clearTimeout(timer); }
  },
};

// The key comes from the environment only (no fallback) and is sent ONLY in the x-goog-api-key header,
// never in a URL, so it cannot leak into proxy/server logs or error messages.
export const geminiKey = () => (process.env.GEMINI_API_KEY || "").trim();
export function geminiTargets(model: string, key: string) {
  const headers: Record<string, string> = { "x-goog-api-key": key, "Content-Type": "application/json" };
  const m = encodeURIComponent(model);
  return [
    { url: `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, headers },
    { url: `https://aiplatform.googleapis.com/v1/publishers/google/models/${m}:generateContent`, headers },
  ];
}

// Gemini via the Gemini API (generativelanguage.googleapis.com), checked against this project's key:
//  - GEMINI_MODEL (default gemini-3.6-flash) answers. GEMINI_FALLBACK_MODEL (default gemini-3.5-flash-lite, which has
//    its own quota; gemini-3.5-flash was found to count against the gemini-3.6-flash quota) is used when the first
//    model is overloaded, out of quota, times out or returns an empty answer. Retired model names are skipped.
//  - Each attempt has a timeout (GEMINI_TIMEOUT_MS, default 25 s) and the whole answer a deadline (50 s).
//  - Quota (HTTP 429): Google's RetryInfo / Retry-After says when to try again. That model (and the model whose quota
//    was charged) is paused until then, so later chats don't call Google again just to be refused, and the same
//    model is never retried in a loop. When every model is paused, the error says whether it is a daily or a
//    per-minute quota and how long to wait.
//  - The Vertex AI endpoint is tried only when the first endpoint refuses the key type (401/403).
//  - Errors are short codes only (never the key, never Google's response body), mapped to friendly text by /api/ai.
const GEMINI_DEFAULT = "gemini-3.6-flash", GEMINI_BACKUP = "gemini-3.5-flash-lite";
const RETIRED = /^gemini-(1\.|2\.0|2\.5)/; // "no longer available to new users" for this project
const DEADLINE_MS = 50_000;
export function geminiModels(): string[] {
  const want = (process.env.GEMINI_MODEL || "").trim(), backup = (process.env.GEMINI_FALLBACK_MODEL || GEMINI_BACKUP).trim();
  const primary = want && !RETIRED.test(want) ? want : GEMINI_DEFAULT;
  return [...new Set([primary, backup].filter(Boolean))];
}

// Error carrying how long to wait (seconds) and the quota kind, for quota / rate-limit answers.
export class AIError extends Error { constructor(code: string, public retryAfter?: number) { super(code); } }

// model -> { until (ms), kind } : in-memory, per server process (this is service state, never user identity).
const paused = new Map<string, { until: number; kind: "day" | "minute" }>();
export const resetGeminiPauses = () => paused.clear(); // tests
function quotaInfo(err: any, header: string | null): { kind: "day" | "minute"; seconds: number; models: string[] } {
  const details: any[] = err?.details || [];
  const violations = details.filter((d) => /QuotaFailure/.test(d?.["@type"] || "")).flatMap((d) => d.violations || []);
  const ids = violations.map((v: any) => String(v.quotaId || v.quotaMetric || "")).join(" ");
  const delay = details.find((d) => /RetryInfo/.test(d?.["@type"] || ""))?.retryDelay; // e.g. "48121s" or "12.5s"
  const fromInfo = delay ? parseFloat(String(delay)) : NaN, fromHeader = header ? Number(header) : NaN;
  const kind: "day" | "minute" = /PerDay/i.test(ids) ? "day" : "minute";
  const seconds = Math.ceil(Number.isFinite(fromInfo) ? fromInfo : Number.isFinite(fromHeader) ? fromHeader : kind === "day" ? 3600 : 60);
  const models = violations.map((v: any) => v?.quotaDimensions?.model).filter(Boolean);
  return { kind, seconds: Math.min(Math.max(seconds, 5), 26 * 3600), models };
}

const gemini: AIProvider = {
  name: "gemini", local: false,
  async generate({ system, messages, file }) {
    const key = geminiKey();
    if (!key) throw new Error("GEMINI_KEY_MISSING");
    const contents = messages.map((m, i) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }, ...(file && i === messages.length - 1 && m.role === "user" ? [{ inlineData: { mimeType: file.mime, data: file.base64 } }] : [])],
    }));
    // Medical photos of sensitive body areas can trip default filters: only block clearly high-risk output.
    const safetySettings = ["HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_DANGEROUS_CONTENT"].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" }));
    const body = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }, safetySettings });
    const perTry = Math.max(5_000, Number(process.env.GEMINI_TIMEOUT_MS) || 25_000), end = Date.now() + DEADLINE_MS;
    let last = "AI_EMPTY", rejected = 0, attempts = 0, quota: { kind: "day" | "minute"; until: number } | null = null;
    const pause = (m: string, kind: "day" | "minute", until: number) => { paused.set(m, { until, kind }); if (!quota || until < quota.until) quota = { kind, until }; };
    for (const model of geminiModels()) {
      const p = paused.get(model);
      if (p && p.until > Date.now()) { if (!quota || p.until < quota.until) quota = { kind: p.kind, until: p.until }; continue; } // still out of quota: don't call Google
      for (const [i, t] of geminiTargets(model, key).entries()) {
        const left = end - Date.now(); if (left < 3_000) throw new Error(last === "AI_EMPTY" ? "AI_TIMEOUT" : last);
        attempts++;
        let r: Response;
        try { r = await fetch(t.url, { method: "POST", headers: t.headers, body, signal: AbortSignal.timeout(Math.min(perTry, left)) }); }
        catch (e: any) { last = e?.name === "TimeoutError" || e?.name === "AbortError" ? "AI_TIMEOUT" : "AI_NETWORK"; break; } // next model
        if (r.ok) {
          paused.delete(model);
          const j: any = await r.json().catch(() => ({}));
          const c = j?.candidates?.[0];
          const text = (c?.content?.parts || []).filter((p: any) => !p.thought && typeof p.text === "string").map((p: any) => p.text).join("").trim();
          if (text) return text;
          if (j?.promptFeedback?.blockReason || c?.finishReason === "SAFETY" || c?.finishReason === "PROHIBITED_CONTENT") throw new Error("AI_BLOCKED");
          last = "AI_EMPTY"; break; // try the backup model
        }
        const err: any = (await r.json().catch(() => ({})))?.error || {};
        if (r.status === 400 && (err.status === "INVALID_ARGUMENT" && /api key/i.test(String(err.message)) || (err.details || []).some((d: any) => d?.reason === "API_KEY_INVALID"))) throw new Error("GEMINI_KEY_INVALID");
        if (r.status === 401 || r.status === 403) { rejected++; last = "GEMINI_KEY_REJECTED"; if (i === 0) continue; break; } // other endpoint may accept this key type
        if (r.status === 404) { last = "AI_MODEL_UNAVAILABLE"; break; } // retired / unknown model: next model
        if (r.status === 429) {
          const q = quotaInfo(err, r.headers.get("retry-after")), until = Date.now() + q.seconds * 1000;
          for (const m of new Set([model, ...q.models])) pause(m, q.kind, until); // also the model whose quota was charged
          console.warn(`Gemini quota: ${q.kind === "day" ? "daily" : "per-minute"} limit reached for ${model}; paused for ${q.seconds}s`); // no key, no prompt
          last = "AI_QUOTA"; break; // never retry the same model; the backup has its own quota
        }
        last = r.status >= 500 ? "AI_BUSY" : "AI HTTP " + r.status; break;
      }
    }
    if (rejected && rejected === attempts) throw new Error("GEMINI_KEY_INVALID"); // every endpoint refused the key
    const q = quota as { kind: "day" | "minute"; until: number } | null;
    if (q && (last === "AI_QUOTA" || attempts === 0 || last === "AI_EMPTY")) // out of quota everywhere (or every model already paused)
      throw new AIError(q.kind === "day" ? "AI_QUOTA_DAY" : "AI_QUOTA_MINUTE", Math.max(1, Math.ceil((q.until - Date.now()) / 1000)));
    throw new Error(last);
  },
};

export function getProvider(): AIProvider | null {
  const want = (process.env.AI_PROVIDER || "auto").toLowerCase();
  if (want === "ollama") return process.env.OLLAMA_MODEL ? ollama : null;
  if (want === "gemini") return geminiKey() ? gemini : null;
  if (process.env.OLLAMA_MODEL) return ollama; // auto: local first
  return geminiKey() ? gemini : null;
}
