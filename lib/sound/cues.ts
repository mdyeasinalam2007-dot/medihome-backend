// MediHome interaction sounds: an original palette of short, soft tones in D-flat major (the key of the background
// music), synthesised live with the Web Audio API from sine waves only: no noise, no samples, no files.
//
// Each category has its own gesture, so they are easy to tell apart without being loud:
//   hover   tiny, airy high chime that lifts a hair          (quietest; pointer entry / keyboard focus)
//   click   warm open fifth with a soft low body             (most definite; activating a button)
//   nav     two quick rising tones                           (tabs, menus, nav links, selections, opening dialogs)
//   menu    the nav gesture an octave lower, softer onset    (main menubar items Doctors..Ratchet AI; see Nav.tsx)
//   back   one tone gliding downward                        (explicit in-app back links)
//   close   short, low tone settling downward                (closing dialogs, drawers, menus)
//   success / error                                          (follow the app's own confirmation and error messages)
// The tones sit between ~400 Hz and ~1.9 kHz, above the music's warm low register (so they stay clear over it at
// modest levels) and below the piercing range. Every tone fades in over a few milliseconds and decays smoothly.

export type CueKind = "hover" | "click" | "nav" | "menu" | "back" | "close" | "success" | "error";
export const CUE_KINDS: readonly CueKind[] = ["hover", "click", "nav", "menu", "back", "close", "success", "error"];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export type Tone = {
  at: number; //        start offset (s)
  midi: number; //      pitch
  to?: number; //       glide target pitch (midi), reached after `glide` seconds
  glide?: number;
  gain: number; //      linear peak level (before the site volume)
  decay: number; //     exponential decay time constant (s); audible length is about 3-4x this
  attack?: number; //   fade-in (s)
  harm2?: number; //    level of a soft octave partial (warmth/clarity)
  pan?: number;
};

// Levels were set by mixing the cues with the actual background music and measuring that each stays perceptible
// over it (see docs/AUDIO_PROVENANCE.md), with hover the softest and click the most definite.
export const PALETTE: Record<CueKind, Tone[]> = {
  hover: [
    { at: 0, midi: 92, to: 92.15, glide: 0.06, gain: 0.05, decay: 0.024, attack: 0.005 }, //   Ab6, lifting slightly
    { at: 0.012, midi: 97, gain: 0.016, decay: 0.02, attack: 0.005, pan: 0.12 }, //             Db7 shimmer
  ],
  click: [
    { at: 0, midi: 87, gain: 0.1, decay: 0.045, attack: 0.004 }, //                             Eb6
    { at: 0.006, midi: 92, gain: 0.07, decay: 0.05, attack: 0.004 }, //                         Ab6 (a fourth above)
    { at: 0, midi: 80, gain: 0.05, decay: 0.03, attack: 0.004 }, //                             Ab5 body
  ],
  nav: [
    { at: 0, midi: 89, gain: 0.07, decay: 0.03, attack: 0.005, pan: -0.06 }, //                F6
    { at: 0.05, midi: 94, gain: 0.06, decay: 0.042, attack: 0.005, pan: 0.06 }, //             Bb6, rising
  ],
  // The same rising F-Bb as nav, an octave lower with a slower fade-in and a faint octave partial: warmer and less
  // piercing. Gains are raised so it keeps about the same A-weighted loudness as nav (within ~0.2 dB).
  menu: [
    { at: 0, midi: 77, gain: 0.075, decay: 0.04, attack: 0.012, harm2: 0.1, pan: -0.06 }, //   F5
    { at: 0.05, midi: 82, gain: 0.066, decay: 0.045, attack: 0.012, harm2: 0.1, pan: 0.06 }, // Bb5, rising
  ],
  back: [
    { at: 0, midi: 94, to: 87, glide: 0.11, gain: 0.07, decay: 0.048, attack: 0.006 }, //      Bb6 gliding down to Eb6
  ],
  close: [
    { at: 0, midi: 92, to: 87, glide: 0.08, gain: 0.06, decay: 0.032, attack: 0.006 }, //      Ab6 settling to Eb6
    { at: 0, midi: 85, to: 80, glide: 0.08, gain: 0.014, decay: 0.022, attack: 0.006 }, //     faint lower partner (Db6 to Ab5)
  ],
  // the same gestures as before, moved up so they stay clear over the music: a rising chime, and a soft falling third
  success: [{ at: 0, midi: 87, gain: 0.06, decay: 0.09, attack: 0.005, harm2: 0.05, pan: -0.06 }, { at: 0.1, midi: 92, gain: 0.055, decay: 0.16, attack: 0.005, harm2: 0.05, pan: 0.06 }],
  error: [{ at: 0, midi: 84, gain: 0.075, decay: 0.08, attack: 0.008, harm2: 0.3 }, { at: 0.13, midi: 81, gain: 0.07, decay: 0.12, attack: 0.008, harm2: 0.3 }],
};

// Minimum time between two cues of the same kind, so fast repeats (sweeping the pointer across a menu, double
// clicks, holding Tab) never pile up.
const GAP: Record<CueKind, number> = { hover: 0.06, click: 0.07, nav: 0.08, menu: 0.08, back: 0.15, close: 0.15, success: 0.6, error: 0.6 };

/** Plays cues into `out`, with rate limiting so repeated interactions never build up. */
export class CuePlayer {
  private last: Record<CueKind, number> = { hover: -1, click: -1, nav: -1, menu: -1, back: -1, close: -1, success: -1, error: -1 };
  private ringing: { end: number; kind: CueKind; stop: () => void }[] = [];
  constructor(private ctx: BaseAudioContext, private out: AudioNode) {}

  /** Returns false when skipped (too soon after the same cue, or too much already ringing). */
  play(kind: CueKind, when = this.ctx.currentTime): boolean {
    if (when - this.last[kind] < GAP[kind]) return false;
    this.ringing = this.ringing.filter((r) => r.end > when);
    if (kind === "hover") {
      if (this.ringing.length) return false; // never chime on top of another sound
    } else {
      // A definite action takes over from a hover chime that is still ringing: one clear sound per action.
      for (const r of this.ringing) if (r.kind === "hover") r.stop();
      this.ringing = this.ringing.filter((r) => r.kind !== "hover");
      if (this.ringing.length > 4) return false;
    }
    this.last[kind] = when;
    for (const t of PALETTE[kind]) this.tone(t, kind, when + 0.004);
    return true;
  }

  private tone(t: Tone, kind: CueKind, start: number) {
    const c = this.ctx, s = start + t.at, attack = t.attack ?? 0.006, end = s + attack + t.decay * 6;
    const amp = c.createGain();
    amp.gain.setValueAtTime(0, s);
    amp.gain.linearRampToValueAtTime(t.gain, s + attack);
    amp.gain.setTargetAtTime(0, s + attack, t.decay); // smooth exponential decay, never a hard stop
    const pan = c.createStereoPanner(); pan.pan.value = t.pan ?? 0;
    amp.connect(pan); pan.connect(this.out);
    const oscs: OscillatorNode[] = [];
    for (const [mult, g] of [[1, 1], [2, t.harm2 ?? 0]] as const) {
      if (!g) continue;
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(hz(t.midi) * mult, s);
      if (t.to !== undefined) o.frequency.exponentialRampToValueAtTime(hz(t.to) * mult, s + (t.glide ?? 0.1));
      const og = c.createGain(); og.gain.value = g; o.connect(og); og.connect(amp);
      o.start(s); o.stop(end); oscs.push(o);
    }
    // a quick (15 ms) fade instead of a cut, if a click takes over from this hover chime
    const stop = () => { const n = c.currentTime; try { amp.gain.cancelScheduledValues(n); amp.gain.setValueAtTime(amp.gain.value, n); amp.gain.linearRampToValueAtTime(0, n + 0.015); } catch { /* ended */ } };
    this.ringing.push({ end, kind, stop });
    oscs[0].onended = () => { try { pan.disconnect(); } catch { /* already gone */ } };
  }
}
