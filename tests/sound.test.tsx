import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { renderToString } from "react-dom/server";
import { CuePlayer, CUE_KINDS, PALETTE, type CueKind } from "../lib/sound/cues";
import { pickRatchetVoice, RATCHET_GREETING } from "../lib/sound/voice";
import { MUSIC, isRatchetRoute } from "../lib/sound/assets";
import { I18nProvider } from "../components/I18nProvider";
import SoundExperience from "../components/SoundExperience";
import RatchetGreeting from "../components/RatchetGreeting";
import { DICTS } from "../lib/i18n/dictionaries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), usePathname: () => "/" }));

const ROOT = path.join(__dirname, "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---- a tiny stand-in for the Web Audio API that records what gets created ----
class FakeParam { value = 0; constructor(v = 0) { this.value = v; }
  setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } setTargetAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; } cancelScheduledValues() { return this; } }
class FakeNode { connect() { return this; } disconnect() {} }
type FakeOsc = FakeNode & { type: string; frequency: FakeParam; started: number[]; start: (t: number) => void; stop: () => void; onended: null | (() => void) };
function fakeCtx() {
  const osc: FakeOsc[] = [], gains: FakeParam[] = [];
  const ctx = {
    currentTime: 0,
    createGain: () => { const g = new FakeParam(1); gains.push(g); return Object.assign(new FakeNode(), { gain: g }); },
    createStereoPanner: () => Object.assign(new FakeNode(), { pan: new FakeParam() }),
    createOscillator: () => { const o = Object.assign(new FakeNode(), { type: "sine", frequency: new FakeParam(440), started: [] as number[], onended: null,
      start(t: number) { o.started.push(t); }, stop() {} }) as FakeOsc; osc.push(o); return o; },
    createBufferSource: () => { throw new Error("cues must not use noise or samples"); },
  };
  return { ctx: ctx as unknown as BaseAudioContext, osc };
}

describe("interaction sounds", () => {
  const sig = (k: CueKind) => { const { ctx, osc } = fakeCtx(); new CuePlayer(ctx, new FakeNode() as unknown as AudioNode).play(k, 1);
    return osc.map((o) => `${o.type}:${Math.round(o.frequency.value)}`).join(" "); };
  const peak = (k: CueKind) => PALETTE[k].reduce((a, t) => a + t.gain, 0);
  const lastPitch = (t: { midi: number; to?: number }) => t.to ?? t.midi;

  it("has a distinct sound for every category, made of sine tones only", () => {
    expect([...CUE_KINDS]).toEqual(["hover", "click", "nav", "menu", "back", "close", "success", "error"]);
    const shape = (k: CueKind) => PALETTE[k].map((t) => `${t.at}:${t.midi}>${t.to ?? t.midi}`).join(" ");
    expect(new Set(CUE_KINDS.map(shape)).size).toBe(CUE_KINDS.length); // no two categories share a gesture
    for (const k of CUE_KINDS) for (const part of sig(k).split(" ")) expect(part.startsWith("sine:")).toBe(true);
  });

  it("each gesture has its own shape: nav rises, back and close fall, hover lifts", () => {
    const [n1, n2] = PALETTE.nav; expect(n2.midi).toBeGreaterThan(n1.midi); expect(n2.at).toBeGreaterThan(n1.at);
    expect(lastPitch(PALETTE.back[0])).toBeLessThan(PALETTE.back[0].midi);
    expect(lastPitch(PALETTE.close[0])).toBeLessThan(PALETTE.close[0].midi);
    expect(PALETTE.close[0].midi).toBeLessThan(PALETTE.back[0].midi); // close sits lower and shorter than back
    expect(lastPitch(PALETTE.hover[0])).toBeGreaterThanOrEqual(PALETTE.hover[0].midi);
  });

  it("the menu cue is a warmer, softer-onset version of the nav gesture", () => {
    const [m1, m2] = PALETTE.menu; expect(m2.midi).toBeGreaterThan(m1.midi); expect(m2.at).toBeGreaterThan(m1.at);
    PALETTE.menu.forEach((t, i) => { expect(t.midi).toBeLessThan(PALETTE.nav[i].midi); expect(t.attack!).toBeGreaterThan(PALETTE.nav[i].attack!); });
  });

  it("every main menubar link (Doctors..Ratchet AI) plays the same click sound as Home", () => {
    const n = read("components/Nav.tsx");
    expect(n).not.toMatch(/data-sound|menuSound/); // no per-link override, so all of them get Home's nav cue
    expect(n).toMatch(/className="l" href=\{href\} \{\.\.\.cur\(href\)\}>/);
    expect(n).toMatch(/className="pill" href=\{href\} \{\.\.\.cur\(href\)\}>/);
  });

  it("click is the most definite, hover the softest, back/close subtle", () => {
    for (const k of ["hover", "nav", "back", "close"] as CueKind[]) expect(peak("click")).toBeGreaterThan(peak(k));
    for (const k of ["click", "nav", "back", "close"] as CueKind[]) expect(peak("hover")).toBeLessThan(peak(k));
    expect(Math.max(peak("back"), peak("close"))).toBeLessThan(peak("click") * 0.6);
  });

  it("interaction sounds are short (about 60-200 ms) with gentle attacks and no piercing pitches", () => {
    for (const k of ["hover", "click", "nav", "menu", "back", "close"] as CueKind[]) {
      const len = Math.max(...PALETTE[k].map((t) => t.at + (t.attack ?? 0.006) + t.decay * 3));
      expect(len).toBeGreaterThan(0.06); expect(len).toBeLessThanOrEqual(0.2);
    }
    for (const k of CUE_KINDS) for (const t of PALETTE[k]) {
      expect(t.attack ?? 0.006).toBeGreaterThanOrEqual(0.004); // no hard clicks
      expect(440 * Math.pow(2, (Math.max(t.midi, t.to ?? 0) - 69) / 12)).toBeLessThan(2400); // nothing shrill
      expect(t.gain).toBeLessThanOrEqual(0.1);
    }
  });

  it("never piles up: repeats are rate-limited and hover never stacks on another sound", () => {
    const { ctx } = fakeCtx(); const p = new CuePlayer(ctx, new FakeNode() as unknown as AudioNode);
    expect(p.play("click", 1)).toBe(true);
    expect(p.play("click", 1.02)).toBe(false); // too soon after the same sound
    expect(p.play("hover", 1.03)).toBe(false); // no hover chime on top of a click
    expect(p.play("nav", 1.04)).toBe(true); //   a different action may sound
    let n = 0; for (let i = 0; i < 40; i++) if (p.play("hover", 3 + i * 0.01)) n++;
    expect(n).toBeLessThanOrEqual(3); // sweeping across 40 controls in 0.4 s: only a few chimes
    expect(p.play("error", 5)).toBe(true); expect(p.play("error", 5.3)).toBe(false);
  });

  it("is wired once, by event delegation, with hover for mouse pointers only and the sound controls silent", () => {
    const w = read("lib/sound/interactions.ts");
    expect(w).toMatch(/e\.pointerType !== "mouse"/);
    expect(w).toMatch(/\(hover: hover\)/);
    expect(w).toMatch(/:focus-visible/);
    expect(w).toMatch(/now - lastSound < ACTION_COVERS_MS/); // one sound per action (dialog open/close after a click)
    expect(w).toMatch(/closest\?\.\("header \.nav-links a, header \.nav-scroll a"\)\) lastAct = 0/); // menubar: no error cue from the opened page
    expect(w).toMatch(/if \(sectionLink\(e\.target\)\) lastAct = 0;/); // page-content links into those sections: same
    for (const ev of ["pointerover", "keydown", "focusin", "click", "change"]) expect(w).toMatch(new RegExp(`removeEventListener\\("${ev}"`));
    const c = read("components/SoundExperience.tsx");
    expect(c.match(/attachInteractionSounds\(/g)?.length).toBe(1);
    expect(c).toMatch(/ignore: \(n\) => !!rootRef\.current\?\.contains\(n\)/);
    expect(c).toMatch(/speaking\(\)\) return; \/\/ speech has priority/);
    const k = read("lib/sound/classify.ts");
    expect(k).toMatch(/BACK = '\.back-link/); // back only for explicit in-app back controls
    // page-content links into Doctors..Ratchet AI: menubar sounds (nav click, hover even inside text), menubar excluded
    expect(k).toMatch(/SECTION_PATH = \/\^\\\/\(doctors\|hospitals\|beds\|blood\|tests\|ambulance\|assistant\)/);
    expect(k).toMatch(/el\.matches\(SELECTION\) \|\| isSectionLink\(el\)\) return "nav"/);
    expect(k).toMatch(/el\.matches\(PROSE_LINK\) && !isSectionLink\(el\)/);
    expect(k).toMatch(/el\.closest\(MENUBAR\)/);
    expect(k).not.toMatch(/popstate/);
  });
});

describe("Ratchet voice", () => {
  const v = (name: string, lang = "en-US") => ({ name, lang, voiceURI: name, localService: true, default: false }) as SpeechSynthesisVoice;
  it("prefers natural male voices, then Google/Apple male, then the Windows male voices", () => {
    expect(pickRatchetVoice([v("Microsoft David - English (United States)"), v("Microsoft Andrew Online (Natural) - English (United States)")]).voice?.name).toMatch(/Andrew/);
    expect(pickRatchetVoice([v("Microsoft David - English (United States)"), v("Google UK English Male", "en-GB")]).voice?.name).toBe("Google UK English Male");
    expect(pickRatchetVoice([v("Microsoft Zira - English (United States)"), v("Microsoft Mark - English (United States)"), v("Microsoft David - English (United States)")]).voice?.name).toMatch(/Mark/);
  });
  it("never picks a female voice as Ratchet's male voice", () => {
    const r = pickRatchetVoice([v("Google US English"), v("Microsoft Zira - English (United States)"), v("Google UK English Female", "en-GB")]);
    expect(r.male).toBe(false); // reported honestly, so the delivery is only lowered a little
  });
  it("speaks the exact introduction", () => {
    expect(RATCHET_GREETING).toBe("Hello, I’m Ratchet, your AI assistant. I’m here to help you navigate MediHome and answer your questions. How can I help you today?");
  });
});

describe("background music asset", () => {
  it("loop settings match the composition source", () => {
    const src = read("scripts/audio/night-sanctuary.js");
    expect(src).toMatch(new RegExp(`const LOOP = ${MUSIC.loopLength};`));
    expect(src).toMatch(new RegExp(`const PAD = ${MUSIC.loopStart};`));
  });
  it("is composed from tones only: no noise sources, samples or randomness outside the reverb", () => {
    const src = read("scripts/audio/night-sanctuary.js");
    expect(src).not.toMatch(/Math\.random|createBufferSource|fetch\(|https?:\/\//);
    expect(src.match(/rnd\(\)/g)?.length).toBe(1); // only inside the reverb impulse
  });
  it("the built files exist, are small, and are real Ogg Opus / AAC", () => {
    for (const s of MUSIC.sources) {
      const f = path.join(ROOT, "public", s.url);
      const b = fs.readFileSync(f);
      expect(b.length).toBeGreaterThan(200_000);
      expect(b.length).toBeLessThan(3_000_000);
      if (s.url.endsWith(".ogg")) { expect(b.subarray(0, 4).toString()).toBe("OggS"); expect(b.includes(Buffer.from("OpusHead"))).toBe(true); }
      else expect(b[0] === 0xff && (b[1] & 0xf0) === 0xf0).toBe(true); // ADTS sync word
    }
    const extra = fs.readdirSync(path.join(ROOT, "public", "audio")).filter((f) => !/^CREDITS\.md$/.test(f) && !MUSIC.sources.some((s) => s.url.endsWith(f)));
    expect(extra).toEqual([]); // nothing else (no leftovers from earlier versions)
  });
});

describe("sound experience integration", () => {
  it("the player is mounted once in the root layout; the greeting only on the Ratchet page", () => {
    expect(read("app/layout.tsx").match(/<SoundExperience \/>/g)?.length).toBe(1);
    expect(read("app/assistant/page.tsx")).toMatch(/<RatchetGreeting \/>/);
    expect(isRatchetRoute("/assistant")).toBe(true);
    expect(isRatchetRoute("/assistant/x")).toBe(true);
    expect(isRatchetRoute("/assistants")).toBe(false);
    expect(isRatchetRoute("/")).toBe(false);
  });

  it("renders nothing on the server and starts nothing there", () => {
    expect(renderToString(<I18nProvider lang="en"><SoundExperience /></I18nProvider>)).toBe("");
    expect(renderToString(<RatchetGreeting />)).toBe("");
  });

  it("tries autoplay, falls back to a gesture, and keeps music off the Ratchet page", () => {
    const c = read("components/SoundExperience.tsx");
    expect(c).toMatch(/if \(!document\.hidden\) void tryAutoplay\(\)/); // attempts on entry
    expect(c).toMatch(/setStat\("blocked"\); arm\(\);/); // blocked: prompt + first interaction
    expect(c).toMatch(/!onRatchet\(\)/); // never starts on the Ratchet page
    expect(c).toMatch(/if \(is\) \{ stopMusic\(0\.5\)/); // entering it fades the music out
    expect(c).toMatch(/speaking\(\)\) return; \/\/ speech has priority/);
    expect(c).toMatch(/new BroadcastChannel/);
    expect(c).toMatch(/src\.loopStart = MUSIC\.loopStart/); // sample-accurate seamless loop
    for (const cleanup of [/detachInteractions\(\)/, /close\(\)/, /removeEventListener\("visibilitychange"/]) expect(c).toMatch(cleanup);
  });

  it("greets once per visit, waits for a gesture when blocked, and stops when leaving", () => {
    const g = read("components/RatchetGreeting.tsx");
    expect(g).toMatch(/u\.onstart = \(\) => \{ started = true; .*markGreeted\(\)/); // marked only once speech really starts
    expect(g).toMatch(/e\.error === "not-allowed"/);
    expect(g).toMatch(/disarm\(\); stopMine\(\);/);
    expect(g).toMatch(/soundMuted\(\)/);
    expect(read("components/SoundExperience.tsx")).toMatch(/sessionStorage\.removeItem\(RATCHET_GREETED_KEY\)/);
  });

  it("documents provenance", () => {
    const doc = read("docs/AUDIO_PROVENANCE.md");
    for (const k of ["night-sanctuary.js", "build-audio.mjs", "WebCodecs", "speechSynthesis", "Licen"]) expect(doc).toContain(k);
    expect(read("public/audio/CREDITS.md")).toContain("docs/AUDIO_PROVENANCE.md");
  });

  it("has every sound label in English and Bangla", () => {
    expect(Object.keys(DICTS.en.sound).sort()).toEqual(Object.keys(DICTS.bn.sound).sort());
    for (const v of Object.values(DICTS.bn.sound)) expect(v.length).toBeGreaterThan(1);
  });
});
