// Background music asset (built by scripts/audio/build-audio.mjs from scripts/audio/night-sanctuary.js).
// The file holds the 128 s loop plus 1 s of extra audio either side; playback loops [loopStart, loopStart + loopLength)
// sample-accurately with Web Audio, so there is no gap or click at the loop point in any browser.
export const MUSIC = {
  sources: [
    { url: "/audio/medihome-night-sanctuary.ogg", type: 'audio/ogg; codecs="opus"' }, // Opus: royalty-free, smaller
    { url: "/audio/medihome-night-sanctuary.aac", type: "audio/aac" }, //                AAC fallback (e.g. older Safari)
  ],
  loopStart: 1, // seconds  (night-sanctuary.js PAD)
  loopLength: 128, // seconds (night-sanctuary.js LOOP)
} as const;

/** The Ratchet AI page. Its own audio (Ratchet's voice) replaces the background music there. */
export const isRatchetRoute = (path: string | null | undefined) => !!path && (path === "/assistant" || path.startsWith("/assistant/"));

/** sessionStorage flag: Ratchet's greeting was spoken during the current visit to the Ratchet page. */
export const RATCHET_GREETED_KEY = "mh_ratchet_greeted";
/** Window event fired when the visitor turns MediHome sound on or off (detail: { on: boolean }). */
export const SOUND_EVENT = "mh:sound";
/** localStorage key for sound settings. */
export const SOUND_PREFS_KEY = "mh_sound";

/** True when the visitor has explicitly turned MediHome sound off. */
export function soundMuted(): boolean {
  try { return JSON.parse(localStorage.getItem(SOUND_PREFS_KEY) || "{}").on === false; } catch { return false; }
}
