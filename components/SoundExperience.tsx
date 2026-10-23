"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { CuePlayer, type CueKind } from "@/lib/sound/cues";
import { attachInteractionSounds } from "@/lib/sound/interactions";
import { MUSIC, RATCHET_GREETED_KEY, SOUND_EVENT, SOUND_PREFS_KEY, isRatchetRoute } from "@/lib/sound/assets";

// MediHome's background music ("Night Sanctuary", a pre-rendered original loop in public/audio) and interface cues.
// Mounted once in the root layout, so one player keeps playing across in-app page changes.
//
// Autoplay: on entry it tries to start the music (softly faded in). Browsers decide whether that is allowed. If
// they block it, a small "Play calm sound" prompt appears and the music starts on the visitor's first click, tap or
// key press anywhere (the prompt can be dismissed for the session). Nothing tries to get around browser rules.
//
// Ratchet AI page (/assistant): the music fades out completely there, so Ratchet's voice is never under music, and
// resumes where it left off when the visitor leaves. Interface cues are suppressed while any speech is playing.
// Only one tab plays at a time. Settings (on/off, music, cues, volume) are remembered in localStorage.

type Prefs = { on: boolean | null; music: boolean; sfx: boolean | null; volume: number }; // null = not chosen yet
// idle: nothing yet · blocked: browser wants a gesture first · playing: music on · held: sound on but no music here
// (Ratchet page, or music switched off) · paused: another tab took over · off: the visitor turned sound off
type Status = "idle" | "blocked" | "playing" | "held" | "paused" | "off";
const PROMPT_KEY = "mh_sound_prompt";
const CHANNEL = "mh-sound";
const DEFAULTS: Prefs = { on: null, music: true, sfx: null, volume: 0.5 };
const ACTIVATION_EVENTS = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;
let mounted = 0; // guards against a second copy ever playing at the same time

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(SOUND_PREFS_KEY) || "{}");
    return {
      on: typeof p.on === "boolean" ? p.on : null,
      music: p.music !== false,
      sfx: typeof p.sfx === "boolean" ? p.sfx : null,
      volume: typeof p.volume === "number" && p.volume >= 0 && p.volume <= 1 ? p.volume : DEFAULTS.volume,
    };
  } catch { return { ...DEFAULTS }; }
}
function savePrefs(p: Prefs) { try { localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(p)); } catch { /* private mode: fine */ } }
const audioCtor = () => (typeof window === "undefined" ? undefined
  : window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
const speaking = () => { try { return !!window.speechSynthesis?.speaking; } catch { return false; } };

export default function SoundExperience() {
  const { t } = useI18n();
  const s = t.sound;
  const path = usePathname();
  const [supported, setSupported] = useState(true);
  const [primary, setPrimary] = useState(false); // false for a duplicate instance
  const [status, setStatus] = useState<Status>("idle");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [panel, setPanel] = useState(false);
  const [promptHidden, setPromptHidden] = useState(true); // decided on mount, so nothing flashes during hydration

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const musicRef = useRef<GainNode | null>(null);
  const cuesRef = useRef<CuePlayer | null>(null);
  const bufRef = useRef<Promise<AudioBuffer | null> | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const posRef = useRef(0); // where in the loop the music is (seconds), so it continues rather than restarts
  const startedAtRef = useRef(0);
  const statusRef = useRef<Status>("idle");
  const prefsRef = useRef<Prefs>(DEFAULTS);
  const pathRef = useRef(path);
  const dismissedRef = useRef(false);
  const hiddenPauseRef = useRef(false);
  const armedRef = useRef(false);
  const genRef = useRef(0); // bumps on unmount, so late async work from an old mount (React Strict Mode) is ignored
  const chanRef = useRef<BroadcastChannel | null>(null);
  const reduceRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  pathRef.current = path;

  const setStat = (v: Status) => { statusRef.current = v; setStatus(v); };
  const update = useCallback((patch: Partial<Prefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next; setPrefs(next); savePrefs(next);
  }, []);
  const onRatchet = () => isRatchetRoute(pathRef.current);
  const gainFor = (v: number) => v * v; // perceptual: the slider feels even

  // The audio graph, created once: music -> master (volume) -> speakers; cues -> master.
  const ensureCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const AC = audioCtor();
    if (!AC) { setSupported(false); return null; }
    try {
      const ctx = new AC({ latencyHint: "playback" });
      const master = ctx.createGain(); master.gain.value = gainFor(prefsRef.current.volume); master.connect(ctx.destination);
      const music = ctx.createGain(); music.gain.value = 0; music.connect(master);
      ctxRef.current = ctx; masterRef.current = master; musicRef.current = music;
      cuesRef.current = new CuePlayer(ctx, master);
      return ctx;
    } catch { setSupported(false); return null; }
  }, []);

  // Fetches and decodes the music once (Opus first, AAC if this browser can't decode Opus). Null if unavailable.
  const loadMusic = useCallback((): Promise<AudioBuffer | null> => {
    if (bufRef.current) return bufRef.current;
    const ctx = ensureCtx();
    if (!ctx) return Promise.resolve(null);
    const probe = document.createElement("audio");
    const order = [...MUSIC.sources].sort((a, b) => Number(!probe.canPlayType(a.type)) - Number(!probe.canPlayType(b.type)));
    bufRef.current = (async () => {
      for (const src of order) {
        try {
          const res = await fetch(src.url);
          if (!res.ok) continue;
          const data = await res.arrayBuffer();
          return await new Promise<AudioBuffer>((ok, bad) => { const p = ctx.decodeAudioData(data, ok, bad); if (p && typeof p.then === "function") p.then(ok, bad); });
        } catch { /* try the next format */ }
      }
      return null; // the site works the same without music
    })();
    return bufRef.current;
  }, [ensureCtx]);

  const stopMusic = useCallback((fade: number) => {
    const ctx = ctxRef.current, src = srcRef.current, g = musicRef.current;
    if (!ctx || !src || !g) return;
    const now = ctx.currentTime;
    posRef.current = (posRef.current + (now - startedAtRef.current)) % MUSIC.loopLength;
    g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + fade);
    try { src.stop(now + fade + 0.05); } catch { /* already stopped */ }
    srcRef.current = null;
  }, []);

  // Starts (or continues) the music with a fade-in, if everything allows it right now.
  const startMusic = useCallback(async (fade: number) => {
    const ctx = ensureCtx();
    if (!ctx || srcRef.current) return;
    const allowed = () => prefsRef.current.on !== false && prefsRef.current.music && !onRatchet() && !document.hidden && ctx.state === "running";
    if (!allowed()) return;
    const buf = await loadMusic();
    if (!buf || srcRef.current || !allowed()) return;
    const g = musicRef.current!, src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.loopStart = MUSIC.loopStart; src.loopEnd = MUSIC.loopStart + MUSIC.loopLength;
    src.connect(g);
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + fade);
    src.start(now, MUSIC.loopStart + posRef.current);
    srcRef.current = src; startedAtRef.current = now;
    setStat("playing");
    try { chanRef.current?.postMessage("playing"); } catch { /* ignore */ }
  }, [ensureCtx, loadMusic]);

  // What "sound on" means on the current page: music on ordinary pages, silence on the Ratchet page.
  const settle = useCallback((fade: number) => {
    if (prefsRef.current.on === false) { setStat("off"); return; }
    if (onRatchet() || !prefsRef.current.music) { stopMusic(onRatchet() ? 0.5 : 1); setStat("held"); return; }
    void startMusic(fade);
  }, [startMusic, stopMusic]);

  // Browsers allow sound after a click, tap or key press. Until then, wait for the first one (anywhere on the page).
  const onActivate = useCallback((e: Event) => {
    if (rootRef.current?.contains(e.target as Node)) return; // the sound controls handle themselves
    if (prefsRef.current.on === false || dismissedRef.current) { disarm(); return; }
    const ctx = ensureCtx(); if (!ctx) return;
    ctx.resume().then(() => { if (ctx.state === "running") { disarm(); settle(6); } }, () => {});
  }, [ensureCtx, settle]); // eslint-disable-line react-hooks/exhaustive-deps
  const arm = useCallback(() => {
    if (armedRef.current) return; armedRef.current = true;
    for (const ev of ACTIVATION_EVENTS) document.addEventListener(ev, onActivate, { capture: true, passive: true });
  }, [onActivate]);
  function disarm() {
    if (!armedRef.current) return; armedRef.current = false;
    for (const ev of ACTIVATION_EVENTS) document.removeEventListener(ev, onActivate, { capture: true });
  }

  // On entry: try to start, as browsers permit.
  const tryAutoplay = useCallback(async () => {
    const gen = genRef.current;
    if (prefsRef.current.on === false) { setStat("off"); return; }
    if (onRatchet()) { setStat("held"); arm(); return; } // no music here; still unlock audio for cues on first touch
    const ctx = ensureCtx(); if (!ctx) return;
    void loadMusic(); // download in the background either way, so the start is instant later
    if (ctx.state !== "running") await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
    if (gen !== genRef.current || ctx !== ctxRef.current) return; // unmounted meanwhile
    if (ctx.state === "running") settle(6);
    else { setStat("blocked"); arm(); }
  }, [arm, ensureCtx, loadMusic, settle]);

  // The visitor's own on/off (always from a click, which also satisfies autoplay rules).
  const turnOn = useCallback(() => {
    update({ on: true }); dismissedRef.current = false;
    const ctx = ensureCtx(); if (!ctx) return;
    window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: { on: true } }));
    ctx.resume().then(() => { disarm(); settle(3); }, () => setStat("blocked"));
  }, [ensureCtx, settle, update]); // eslint-disable-line react-hooks/exhaustive-deps
  const turnOff = useCallback(() => {
    update({ on: false }); stopMusic(0.5); disarm(); setStat("off");
    window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: { on: false } }));
  }, [stopMusic, update]); // eslint-disable-line react-hooks/exhaustive-deps

  const cue = useCallback((k: CueKind) => {
    const p = prefsRef.current, ctx = ctxRef.current;
    const sfx = p.sfx ?? !reduceRef.current; // cues default to off for visitors who ask for reduced motion
    if (p.on === false || !sfx || !ctx || ctx.state !== "running" || document.hidden || speaking()) return; // speech has priority
    try { cuesRef.current?.play(k); } catch { /* never break a click */ }
  }, []);

  // Mount: restore settings, wire up listeners, then try to start.
  useEffect(() => {
    if (mounted > 0) return; // a second instance stays inert and renders nothing
    mounted++;
    setPrimary(true);
    if (!audioCtor()) { setSupported(false); return () => { mounted--; }; }
    const p = loadPrefs(); prefsRef.current = p; setPrefs(p);
    reduceRef.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    try { dismissedRef.current = sessionStorage.getItem(PROMPT_KEY) === "hidden"; } catch { /* ignore */ }
    setPromptHidden(dismissedRef.current);

    // One tab at a time: when another tab starts music, this one fades out (its settings stay as they are).
    try {
      const ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = (e) => { if (e.data === "playing" && srcRef.current) { stopMusic(0.8); setStat("paused"); } };
      chanRef.current = ch;
    } catch { /* older browsers: fine */ }

    // Pause while the tab is hidden; continue softly when the visitor comes back.
    const onVis = () => {
      const ctx = ctxRef.current;
      if (document.hidden) {
        if (srcRef.current) { hiddenPauseRef.current = true; stopMusic(0.4); }
        if (ctx && ctx.state === "running") setTimeout(() => { if (document.hidden) ctx.suspend().catch(() => {}); }, 500);
      } else if (ctx) {
        ctx.resume().then(() => {
          if (hiddenPauseRef.current) { hiddenPauseRef.current = false; settle(2); }
          else if (statusRef.current === "idle") void tryAutoplay();
        }, () => {});
      } else if (statusRef.current === "idle") void tryAutoplay();
    };
    document.addEventListener("visibilitychange", onVis);

    // Interaction sounds (hover/focus, click, navigation, back, close, success, error): lib/sound/interactions.ts.
    // The sound controls themselves stay silent.
    const detachInteractions = attachInteractionSounds({ cue, ignore: (n) => !!rootRef.current?.contains(n) });

    if (!document.hidden) void tryAutoplay();

    return () => {
      mounted--; genRef.current++; // eslint-disable-line react-hooks/exhaustive-deps
      detachInteractions(); disarm();
      document.removeEventListener("visibilitychange", onVis);
      try { chanRef.current?.close(); } catch { /* ignore */ }
      chanRef.current = null;
      try { srcRef.current?.stop(); } catch { /* ignore */ }
      srcRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null; masterRef.current = null; musicRef.current = null; cuesRef.current = null; bufRef.current = null;
      statusRef.current = "idle";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Page changes: music stops on the Ratchet page and continues (where it left off) after leaving it.
  const prevPath = useRef(path);
  useEffect(() => {
    if (!primary) return;
    const was = isRatchetRoute(prevPath.current), is = isRatchetRoute(path);
    prevPath.current = path;
    if (was === is) return;
    if (was && !is) { try { sessionStorage.removeItem(RATCHET_GREETED_KEY); } catch { /* ignore */ } } // next visit greets again
    const st = statusRef.current;
    if (st === "off" || st === "paused") return;
    const ctx = ctxRef.current;
    if (is) { stopMusic(0.5); if (st !== "blocked" && st !== "idle") setStat("held"); return; }
    if (ctx && ctx.state === "running") settle(3);
    else void tryAutoplay();
  }, [path, primary]); // eslint-disable-line react-hooks/exhaustive-deps

  // Settings panel: closes on Escape (focus returns to its button) or a click elsewhere.
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setPanel(false); gearRef.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setPanel(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [panel]);

  if (!primary || !supported) return null;
  const on = status === "playing" || status === "held";
  const pct = Math.round(prefs.volume * 100);
  const sfxOn = prefs.sfx ?? !reduceRef.current;
  const showPrompt = status === "blocked" && !promptHidden && !isRatchetRoute(path);

  return (
    <div className="snd" ref={rootRef} data-sound="none">
      {panel && (
        <div className="snd-panel" id="snd-panel" role="group" aria-label={s.settings}>
          <p className="snd-title">{s.title}</p>
          <button type="button" role="switch" aria-checked={prefs.music} className="snd-row"
            onClick={() => { update({ music: !prefs.music }); if (on) settle(3); }}>
            <span>{s.music}</span><span className="snd-sw" aria-hidden />
          </button>
          <button type="button" role="switch" aria-checked={sfxOn} className="snd-row" onClick={() => update({ sfx: !sfxOn })}>
            <span>{s.effects}</span><span className="snd-sw" aria-hidden />
          </button>
          <label className="snd-vol">
            <span>{s.volume}</span>
            <input type="range" min={0} max={100} step={5} value={pct} aria-valuetext={`${pct}%`}
              onChange={(e) => {
                const v = Number(e.target.value) / 100; update({ volume: v });
                const m = masterRef.current, ctx = ctxRef.current;
                if (m && ctx) { m.gain.cancelScheduledValues(ctx.currentTime); m.gain.setTargetAtTime(gainFor(v), ctx.currentTime, 0.08); }
              }} />
          </label>
        </div>
      )}
      <div className="snd-bar">
        {showPrompt && (
          <div className="snd-prompt">
            <button type="button" className="snd-go" onClick={turnOn} title={s.enable}><Waves /><span className="snd-go-t">{s.enable}</span></button>
            <button type="button" className="snd-x" aria-label={s.dismiss} title={s.dismiss}
              onClick={() => { dismissedRef.current = true; disarm(); setPromptHidden(true); try { sessionStorage.setItem(PROMPT_KEY, "hidden"); } catch { /* ignore */ } }}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
        <button type="button" ref={gearRef} className="snd-btn snd-gear" aria-label={s.settings} title={s.settings}
          aria-expanded={panel} aria-controls={panel ? "snd-panel" : undefined} onClick={() => setPanel((v) => !v)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
          </svg>
        </button>
        <button type="button" className={"snd-btn snd-main" + (on ? " on" : "")} aria-pressed={on}
          aria-label={on ? s.turnOff : s.turnOn} title={on ? s.turnOff : s.turnOn} onClick={on ? turnOff : turnOn}>
          {status === "playing" ? <span className="snd-eq" aria-hidden><i /><i /><i /><i /></span> : on ? <Speaker /> : <Muted />}
        </button>
      </div>
    </div>
  );
}

const Waves = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h2M8 8v8M12 5v14M16 9v6M20 11v2" />
  </svg>
);
const Speaker = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 9.5a4 4 0 0 1 0 5" />
  </svg>
);
const Muted = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 9l4 6M21 9l-4 6" />
  </svg>
);
