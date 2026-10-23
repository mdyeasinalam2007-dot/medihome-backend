// Builds MediHome's background music from source (scripts/audio/night-sanctuary.js) using the local Chrome browser:
// renders it offline, measures it, encodes it (Opus in Ogg, plus AAC as a fallback), writes public/audio/, then
// decodes the written files again and checks the loop point. No npm packages, no network services.
//
//   node scripts/audio/build-audio.mjs                  build public/audio/*
//   node scripts/audio/build-audio.mjs --preview <dir>  also write WAV previews (music x1.5 loops, interface cues)
//   node scripts/audio/build-audio.mjs --stems          also measure each layer on its own (slower)
//   CHROME_PATH=... to use a specific Chrome/Edge executable.
import { spawn } from "child_process"; import fs from "fs"; import path from "path"; import http from "http"; import os from "os";
import { createRequire } from "module"; import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "public", "audio");
const NAME = "medihome-night-sanctuary";
const args = process.argv.slice(2), stems = args.includes("--stems"), previewDir = args.includes("--preview") ? path.resolve(args[args.indexOf("--preview") + 1]) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- a tiny local web server (WebCodecs needs a secure context; http://127.0.0.1 counts as one) ---
const require = createRequire(path.join(ROOT, "package.json")); const ts = require("typescript");
const cues = ts.transpileModule(fs.readFileSync(path.join(ROOT, "lib/sound/cues.ts"), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const files = {
  "/": ["text/html", '<!doctype html><meta charset="utf-8"><script src="/night-sanctuary.js"></script><script src="/analyze.js"></script>'],
  "/night-sanctuary.js": ["text/javascript", () => fs.readFileSync(path.join(ROOT, "scripts/audio/night-sanctuary.js"))],
  "/analyze.js": ["text/javascript", () => fs.readFileSync(path.join(ROOT, "scripts/audio/analyze.js"))],
  "/cues.js": ["text/javascript", cues],
};
const server = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  if (u.startsWith("/audio/")) { const f = path.join(OUT, path.basename(u)); if (fs.existsSync(f)) { res.writeHead(200, { "content-type": "application/octet-stream" }); return res.end(fs.readFileSync(f)); } }
  const e = files[u]; if (!e) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": e[0] }); res.end(typeof e[1] === "function" ? e[1]() : e[1]);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// --- local Chrome, driven over the DevTools protocol ---
const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
if (!chrome) throw new Error("No Chrome/Edge found; set CHROME_PATH");
const prof = fs.mkdtempSync(path.join(os.tmpdir(), "mh-audio-"));
const port = 9400 + Math.floor(Math.random() * 400);
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, base + "/"], { stdio: "ignore" });
let tg; for (let i = 0; i < 80 && !tg; i++) { try { tg = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch { /* starting */ } if (!tg) await sleep(200); }
const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error((r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails)).slice(0, 800)); return r.result?.result?.value; };
for (let i = 0; i < 50 && !(await ev("!!window.NightSanctuary && !!window.analyze").catch(() => false)); i++) await sleep(200);
const finish = (code) => { try { ws.close(); proc.kill(); server.close(); fs.rmSync(prof, { recursive: true, force: true }); } catch { /* ignore */ } process.exit(code); };

try {
  // 1) render + measure (whole mix and each layer alone)
  console.log("Rendering Night Sanctuary (2 passes, keeping the second)...");
  const m = await ev(`(async () => { const t0 = performance.now(); window.__music = await NightSanctuary.render(48000); const ms = Math.round(performance.now() - t0);
    const r = { renderMs: ms, seconds: __music.duration, mix: analyze(__music) };
    if (${stems}) for (const s of ["pad", "shimmer", "flute"]) { const b = await NightSanctuary.render(48000, { pad: 0, shimmer: 0, flute: 0, [s]: 1 }); r[s] = analyze(b); }
    return r; })()`);
  console.log(JSON.stringify(m, null, 1));

  // 2) normalise: peak -3 dBFS (headroom for the encoders)
  const gain = await ev(`(() => { let pk = 0; for (let c = 0; c < 2; c++) for (const v of __music.getChannelData(c)) pk = Math.max(pk, Math.abs(v));
    const g = Math.pow(10, -3 / 20) / pk; for (let c = 0; c < 2; c++) { const d = __music.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; } return g; })()`);
  console.log("normalised: gain", gain.toFixed(3), "->", JSON.stringify(await ev("analyze(__music)")));

  // 3) encode with the browser's own encoders (WebCodecs)
  const encode = (cfg) => ev(`(async () => {
    const chunks = []; let desc = null;
    const enc = new AudioEncoder({ output: (c, meta) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push({ b: Array.from(b), d: c.duration });
      if (meta?.decoderConfig?.description && !desc) desc = Array.from(new Uint8Array(meta.decoderConfig.description)); }, error: (e) => { throw e; } });
    enc.configure(${JSON.stringify(cfg)});
    const b = __music, n = b.length, step = 4800;
    for (let i = 0; i < n; i += step) { const len = Math.min(step, n - i), data = new Float32Array(len * 2);
      data.set(b.getChannelData(0).subarray(i, i + len), 0); data.set(b.getChannelData(1).subarray(i, i + len), len);
      enc.encode(new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data })); }
    await enc.flush(); enc.close(); return { chunks, desc, frames: n }; })()`);
  const opus = await encode({ codec: "opus", sampleRate: 48000, numberOfChannels: 2, bitrate: 96000 });
  const aac = await encode({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 128000, aac: { format: "adts" } });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, NAME + ".ogg"), oggOpus(opus));
  fs.writeFileSync(path.join(OUT, NAME + ".aac"), Buffer.concat(aac.chunks.map((c) => Buffer.from(c.b))));
  for (const ext of ["ogg", "aac"]) console.log(`wrote public/audio/${NAME}.${ext}  ${(fs.statSync(path.join(OUT, NAME + "." + ext)).size / 1024).toFixed(0)} KB`);

  // 4) decode what was written and check it: level, noise-likeness, and the loop point
  const v = await ev(`(async () => { const r = {}; const ac = new OfflineAudioContext(2, 48000, 48000);
    for (const ext of ["ogg", "aac"]) { const buf = await ac.decodeAudioData(await (await fetch("/audio/${NAME}." + ext)).arrayBuffer());
      const sr = buf.sampleRate, ls = NightSanctuary.PAD * sr, le = (NightSanctuary.PAD + NightSanctuary.LOOP) * sr;
      let seam = 0, step = 0, diff = 0, ref = 0;
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); seam = Math.max(seam, Math.abs(d[ls] - d[le - 1]));
        for (let i = ls + 1; i < le; i++) step = Math.max(step, Math.abs(d[i] - d[i - 1]));
        for (let k = 0; k < sr * 0.5; k++) { diff += (d[ls + k] - d[le + k]) ** 2; ref += d[ls + k] ** 2; } }
      r[ext] = { seconds: +buf.duration.toFixed(3), ...analyze(buf, NightSanctuary.PAD, NightSanctuary.PAD + NightSanctuary.LOOP),
        loopPointStep: +seam.toFixed(4), largestStepInLoop: +step.toFixed(4), periodicityErrorDb: +(10 * Math.log10(diff / ref)).toFixed(1) };
      if (ext === "ogg") window.__dec = buf; }
    return r; })()`);
  console.log("decoded files:", JSON.stringify(v, null, 1));

  // 5) optional listening previews
  if (previewDir) {
    fs.mkdirSync(previewDir, { recursive: true });
    const wav = (expr, file) => ev(`(() => { const b = ${expr}, n = b.length, sr = b.sampleRate, L = b.getChannelData(0), R = b.getChannelData(b.numberOfChannels > 1 ? 1 : 0);
      const v = new DataView(new ArrayBuffer(44 + n * 4)); const s = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
      s(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); s(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); s(36, "data"); v.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
      const u = new Uint8Array(v.buffer); let bin = ""; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); })()`)
      .then((b64) => fs.writeFileSync(path.join(previewDir, file), Buffer.from(b64, "base64")));
    // the decoded .ogg exactly as the site loops it: one full loop and then half of it again (so the loop point is audible at 2:08)
    await ev(`(() => { const sr = __dec.sampleRate, ls = NightSanctuary.PAD * sr, L = NightSanctuary.LOOP * sr, n = Math.floor(L * 1.5); const out = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr });
      for (let c = 0; c < 2; c++) { const d = __dec.getChannelData(c), o = out.getChannelData(c); for (let i = 0; i < n; i++) o[i] = d[ls + (i % L)]; } window.__prev = out; return 1; })()`);
    await wav("__prev", "music-preview-as-looped-on-site.wav");
    // interface cues, each at the site's default volume (50%), one every 1.5 s: click, toggle, success, error
    await ev(`(async () => { const { CuePlayer, CUE_KINDS } = await import("/cues.js"); const ctx = new OfflineAudioContext(2, 48000 * 1.5 * CUE_KINDS.length, 48000);
      const g = ctx.createGain(); g.gain.value = 0.25; g.connect(ctx.destination); const p = new CuePlayer(ctx, g); CUE_KINDS.forEach((k, i) => p.play(k, 0.2 + i * 1.5));
      window.__cues = await ctx.startRendering(); return 1; })()`);
    await wav("__cues", "ui-cues-preview.wav");
    console.log("cue analysis:", JSON.stringify(await ev(`(async () => { const { CuePlayer, CUE_KINDS } = await import("/cues.js"); const r = {};
      for (const k of CUE_KINDS) { const ctx = new OfflineAudioContext(2, 48000 * 1.5, 48000); new CuePlayer(ctx, ctx.destination).play(k, 0.05); const b = await ctx.startRendering();
        const d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 0.0005) last = i;
        const a = analyze(b); r[k] = { peakDb: a.peakDb, audibleMs: Math.round(last / 48 - 50), flatness: a.flatnessMedian }; } return r; })()`), null, 1));
    console.log("previews written to", previewDir);
  }
  finish(0);
} catch (e) { console.error(e); finish(1); }

// ---- Ogg Opus container (RFC 7845), written by hand to avoid dependencies ----
function oggOpus({ chunks, desc, frames }) {
  const preSkip = desc && desc.length >= 19 ? desc[10] | (desc[11] << 8) : 312;
  const head = desc && desc.length >= 19 ? Buffer.from(desc) : (() => { const h = Buffer.alloc(19); h.write("OpusHead", 0); h[8] = 1; h[9] = 2; h.writeUInt16LE(preSkip, 10); h.writeUInt32LE(48000, 12); return h; })();
  const vendor = Buffer.from("MediHome build-audio (Chrome WebCodecs Opus)");
  const comment = Buffer.from("TITLE=MediHome Night Sanctuary (original, see docs/AUDIO_PROVENANCE.md)");
  const tags = Buffer.concat([Buffer.from("OpusTags"), u32(vendor.length), vendor, u32(1), u32(comment.length), comment]);
  const serial = 0x4d48a11d; let seq = 0;
  const pages = [page(2, 0n, [head]), page(0, 0n, [tags])];
  let samples = 0, group = [], segs = 0;
  chunks.forEach((c, i) => {
    const n = Math.floor(c.b.length / 255) + 1;
    if (segs + n > 255 || group.length >= 50) { pages.push(page(0, BigInt(preSkip + samples), group)); group = []; segs = 0; }
    group.push(Buffer.from(c.b)); segs += n; samples += Math.round((c.d || 20000) * 48000 / 1e6);
    if (i === chunks.length - 1) pages.push(page(4, BigInt(preSkip + frames), group)); // last page: exact length, trims padding
  });
  return Buffer.concat(pages);
  function u32(x) { const b = Buffer.alloc(4); b.writeUInt32LE(x); return b; }
  function page(type, granule, packets) {
    const lace = []; for (const p of packets) { let l = p.length; while (l >= 255) { lace.push(255); l -= 255; } lace.push(l); }
    const h = Buffer.alloc(27 + lace.length); h.write("OggS", 0); h[4] = 0; h[5] = type; h.writeBigUInt64LE(granule, 6);
    h.writeUInt32LE(serial, 14); h.writeUInt32LE(seq++, 18); h.writeUInt32LE(0, 22); h[26] = lace.length; lace.forEach((l, i) => (h[27 + i] = l));
    const p = Buffer.concat([h, ...packets]); p.writeUInt32LE(crc(p), 22); return p;
  }
  function crc(buf) { let c = 0; for (const b of buf) { c ^= b << 24; for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1; } return c >>> 0; }
}
