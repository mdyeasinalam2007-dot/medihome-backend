"use client";
import { useEffect } from "react";
import { RATCHET_GREETED_KEY, SOUND_EVENT, soundMuted } from "@/lib/sound/assets";
import { RATCHET_GREETING, pickRatchetVoice } from "@/lib/sound/voice";

// Ratchet's spoken introduction on the Ratchet AI page, using the browser's own speech synthesis (no audio files,
// no external service). Spoken once per visit to the page:
// - the "greeted" flag lives in sessionStorage and is only set once speech has actually started, so React Strict
//   Mode's double mount, re-renders and refreshes don't repeat it; SoundExperience clears it when the visitor leaves
//   the Ratchet page, so the next visit greets again.
// - if the browser blocks speech until the visitor interacts (common on a fresh page load), the greeting waits and
//   plays on the first click, tap or key press. It is never forced.
// - it starts after a short pause, so the background music has already faded out; it stops if the visitor leaves
//   the page or turns MediHome sound off; it never speaks if sound is off.

const ACTIVATION = ["pointerup", "touchend", "keydown", "click"] as const;
const BLOCKED_AFTER_MS = 4000; // no start within this time = the browser is holding speech back until a gesture
let current: SpeechSynthesisUtterance | null = null; // the one greeting that may be in progress (module-wide)

const greeted = () => { try { return sessionStorage.getItem(RATCHET_GREETED_KEY) === "1"; } catch { return false; } };
const markGreeted = () => { try { sessionStorage.setItem(RATCHET_GREETED_KEY, "1"); } catch { /* ignore */ } };

export default function RatchetGreeting() {
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined" || greeted()) return;
    let disposed = false, armed = false, watchdog: number | undefined;

    const stopMine = () => { if (current) { const u = current; current = null; if (synth.speaking || synth.pending) { u.onend = null; synth.cancel(); } } };
    const disarm = () => { if (!armed) return; armed = false; for (const e of ACTIVATION) document.removeEventListener(e, onGesture, { capture: true }); };
    const arm = () => { if (armed || disposed) return; armed = true; for (const e of ACTIVATION) document.addEventListener(e, onGesture, { capture: true, passive: true }); };
    function onGesture() { disarm(); speak(); }

    const voicesReady = () => new Promise<SpeechSynthesisVoice[]>((done) => {
      const v = synth.getVoices(); if (v.length) return done(v);
      const t = window.setTimeout(() => done(synth.getVoices()), 1500);
      synth.addEventListener?.("voiceschanged", () => { window.clearTimeout(t); done(synth.getVoices()); }, { once: true });
    });

    async function speak() {
      if (disposed || greeted() || soundMuted() || current) return;
      if (synth!.speaking) return; // something else (e.g. a reply) is already talking; don't talk over it
      const choice = pickRatchetVoice(await voicesReady());
      if (disposed || greeted() || soundMuted() || current) return;
      const u = new SpeechSynthesisUtterance(RATCHET_GREETING);
      if (choice.voice) { u.voice = choice.voice; u.lang = choice.voice.lang; } else u.lang = "en-US";
      u.pitch = choice.pitch; u.rate = choice.rate; u.volume = 1;
      let started = false;
      u.onstart = () => { started = true; window.clearTimeout(watchdog); markGreeted(); };
      u.onend = () => { if (current === u) current = null; };
      u.onerror = (e) => {
        if (current === u) current = null;
        window.clearTimeout(watchdog);
        if (!started && !disposed && (e.error === "not-allowed" || e.error === "interrupted" || e.error === "canceled")) arm(); // try again on a gesture
      };
      current = u;
      try { synth!.speak(u); } catch { current = null; arm(); return; }
      // Some browsers neither start nor report an error while speech is blocked: give up quietly and wait for a gesture.
      watchdog = window.setTimeout(() => { if (!started && current === u && !disposed) { stopMine(); arm(); } }, BLOCKED_AFTER_MS);
    }

    const onSound = (e: Event) => { if ((e as CustomEvent<{ on: boolean }>).detail?.on === false) { disarm(); stopMine(); } };
    window.addEventListener(SOUND_EVENT, onSound);
    const timer = window.setTimeout(speak, 700); // lets the background music fade out first

    return () => {
      disposed = true;
      window.clearTimeout(timer); window.clearTimeout(watchdog);
      window.removeEventListener(SOUND_EVENT, onSound);
      disarm(); stopMine(); // leaving the page (or a Strict Mode remount) never leaves the greeting talking
    };
  }, []);
  return null;
}
