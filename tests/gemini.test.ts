import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { getProvider, geminiModels, resetGeminiPauses, AIError } from "../lib/ai";

const KEY = "TEST-KEY-not-real-123";
const ok = (text: string, extra: any[] = []) => new Response(JSON.stringify({ candidates: [{ content: { parts: [...extra, { text }] }, finishReason: "STOP" }] }), { status: 200 });
const err = (status: number, body: any = {}) => new Response(JSON.stringify({ error: body }), { status });
const ask = () => getProvider()!.generate({ system: "s", messages: [{ role: "user", text: "hello" }] });

beforeEach(() => { process.env.GEMINI_API_KEY = KEY; process.env.AI_PROVIDER = "gemini"; delete process.env.GEMINI_MODEL; delete process.env.GEMINI_FALLBACK_MODEL; delete process.env.OLLAMA_MODEL; resetGeminiPauses(); });
afterEach(() => vi.restoreAllMocks());

describe("Gemini provider", () => {
  it("uses a supported model by default and skips retired model names", () => {
    expect(geminiModels()[0]).toBe("gemini-3.6-flash");
    process.env.GEMINI_MODEL = "gemini-2.5-flash"; expect(geminiModels()[0]).toBe("gemini-3.6-flash");
    expect(geminiModels()).toEqual(["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
    process.env.GEMINI_MODEL = "gemini-3.7-flash"; expect(geminiModels()).toEqual(["gemini-3.7-flash", "gemini-3.5-flash-lite"]);
  });
  it("returns the answer without the model's internal reasoning parts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Hello!", [{ text: "thinking…", thought: true }]));
    expect(await ask()).toBe("Hello!");
  });
  it("falls back to the backup model when Google is overloaded", async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u: any) => { urls.push(String(u)); return urls.length === 1 ? err(503, { status: "UNAVAILABLE" }) : ok("from backup"); });
    expect(await ask()).toBe("from backup");
    expect(urls[0]).toContain("gemini-3.6-flash"); expect(urls[1]).toContain("gemini-3.5-flash-lite");
  });
  it("stops at once on an invalid key (no pointless retries) and never puts the key in errors or URLs", async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u: any) => { urls.push(String(u)); return err(400, { status: "INVALID_ARGUMENT", message: "API key not valid. Please pass a valid API key.", details: [{ reason: "API_KEY_INVALID" }] }); });
    const e = await ask().catch((x) => x);
    expect(e.message).toBe("GEMINI_KEY_INVALID");
    expect(urls).toHaveLength(1);
    expect(urls.join(" ") + e.message).not.toContain(KEY);
  });
  it("reports a rejected key when every endpoint refuses it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(err(403, { status: "PERMISSION_DENIED" }));
    expect((await ask().catch((x) => x)).message).toBe("GEMINI_KEY_INVALID");
  });
  it("turns timeouts and rate limits into short codes", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    expect((await ask().catch((x) => x)).message).toBe("AI_TIMEOUT");
    resetGeminiPauses();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => err(429, { status: "RESOURCE_EXHAUSTED" }));
    const q = await ask().catch((x) => x);
    expect(q).toBeInstanceOf(AIError); expect(q.message).toBe("AI_QUOTA_MINUTE"); expect(q.retryAfter).toBeGreaterThan(50);
  });
  it("reports blocked content instead of retrying", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 }));
    expect((await ask().catch((x) => x)).message).toBe("AI_BLOCKED");
  });
  it("is unavailable (not crashing) without a key", () => {
    delete process.env.GEMINI_API_KEY; expect(getProvider()).toBeNull();
  });
});

// Google 429 body shaped like the real one seen for this project (daily free-tier quota, ~13 h retry).
const dayQuota = (model: string) => err(429, { status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota", details: [
  { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "20", quotaDimensions: { model, location: "global" } }] },
  { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "48121s" }] });
describe("Gemini quota handling", () => {
  it("reports a DAILY quota with Google's retry time, and does not call Google again while paused", async () => {
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => { calls++; return dayQuota("gemini-3.6-flash"); });
    const e1 = await ask().catch((x) => x);
    expect(e1.message).toBe("AI_QUOTA_DAY"); expect(e1.retryAfter).toBeGreaterThan(48000);
    expect(calls).toBe(2); // primary once, backup once: never the same model twice
    const e2 = await ask().catch((x) => x);
    expect(e2.message).toBe("AI_QUOTA_DAY"); expect(calls).toBe(2); // paused: no new request to Google
  });
  it("uses the backup model when only the primary is out of quota", async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u: any) => { urls.push(String(u)); return /3.6-flash/.test(String(u)) ? dayQuota("gemini-3.6-flash") : ok("from lite"); });
    expect(await ask()).toBe("from lite");
    expect(await ask()).toBe("from lite");
    expect(urls.filter((u) => /3.6-flash/.test(u))).toHaveLength(1); // primary skipped while paused
  });
  it("also pauses a model whose requests were charged to another model's quota", async () => {
    process.env.GEMINI_FALLBACK_MODEL = "gemini-3.5-flash";
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => { calls++; return dayQuota("gemini-3.6-flash"); });
    await ask().catch(() => null); expect(calls).toBe(2);
    await ask().catch(() => null); expect(calls).toBe(2);
  });
  it("respects a Retry-After header when Google gives no RetryInfo", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), { status: 429, headers: { "retry-after": "120" } }));
    const e = await ask().catch((x) => x);
    expect(e.message).toBe("AI_QUOTA_MINUTE"); expect(e.retryAfter).toBeGreaterThanOrEqual(118); expect(e.retryAfter).toBeLessThanOrEqual(120);
  });
});

describe("Ratchet chat API messages", () => {
  const route = fs.readFileSync(path.join(__dirname, "..", "app/api/ai/route.ts"), "utf8");
  it("never tells patients about server configuration or keys", () => {
    const msgs = [...route.matchAll(/HttpError\(\d+, ("[^"]*"|`[^`]*`|[A-Z_]+)/g)].map((m) => m[1]).join(" ") + route.match(/const UNAVAILABLE = [^\n]+/)![0];
    expect(msgs).not.toMatch(/GEMINI_API_KEY|AI_PROVIDER|\.env|SEARXNG/);
  });
  it("has a per-minute and a daily limit per user, each with its own code, distinct from Google's quota", () => {
    expect(route).toMatch(/limit\("ai:" \+ u\.id, 15, 60_000\)/);
    expect(route).toMatch(/limit\("ai-day:" \+ u\.id, 300,/);
    for (const c of ["USER_RATE_MINUTE", "USER_RATE_DAY", "AI_QUOTA_DAY", "AI_QUOTA_MINUTE"]) expect(route).toContain(c);
    expect(route).toMatch(/"Retry-After": String\(retryAfter\)/);
  });
});

describe("emergency guidance is never rate-limited", () => {
  it("checks for emergencies before applying the per-user limits", () => {
    const route = fs.readFileSync(path.join(__dirname, "..", "app/api/ai/route.ts"), "utf8");
    expect(route.indexOf("if (isEmergency(last))")).toBeGreaterThan(0);
    expect(route.indexOf("if (isEmergency(last))")).toBeLessThan(route.indexOf('limit("ai:" + u.id'));
  });
});
