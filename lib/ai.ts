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

const gemini: AIProvider = {
  name: "gemini", local: false,
  async generate({ system, messages, file }) {
    const key = process.env.GEMINI_API_KEY!, aiza = key.startsWith("AIza"); // AIza... = Gemini API key, AQ.... = Vertex AI key
    const model = process.env.GEMINI_MODEL || (aiza ? "gemini-2.0-flash" : "gemini-2.5-flash");
    const contents = messages.map((m, i) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }, ...(file && i === messages.length - 1 && m.role === "user" ? [{ inlineData: { mimeType: file.mime, data: file.base64 } }] : [])] }));
    // Medical photos of sensitive body areas can trip default filters: only block clearly high-risk output.
    const safetySettings = ["HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_DANGEROUS_CONTENT"].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" }));
    const body = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.3 }, safetySettings });
    const dev = { url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, headers: { "x-goog-api-key": key } as Record<string, string> };
    const vertex = { url: `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key)}`, headers: {} as Record<string, string> };
    let status = 0, blocked = false;
    for (const t of aiza ? [dev, vertex] : [vertex, dev]) {
      const r = await fetch(t.url, { method: "POST", headers: { "Content-Type": "application/json", ...t.headers }, body }); status = r.status;
      if (!r.ok) continue;
      const j: any = await r.json(), text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("");
      if (text) return text;
      if (j?.promptFeedback?.blockReason || j?.candidates?.[0]?.finishReason === "SAFETY") blocked = true;
    }
    throw new Error(blocked ? "AI_BLOCKED" : status && status !== 200 ? "AI HTTP " + status : "AI_EMPTY"); // never includes the key
  },
};

export function getProvider(): AIProvider | null {
  const want = (process.env.AI_PROVIDER || "auto").toLowerCase();
  if (want === "ollama") return process.env.OLLAMA_MODEL ? ollama : null;
  if (want === "gemini") return process.env.GEMINI_API_KEY ? gemini : null;
  if (process.env.OLLAMA_MODEL) return ollama; // auto: local first
  return process.env.GEMINI_API_KEY ? gemini : null;
}
