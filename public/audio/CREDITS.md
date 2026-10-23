# Audio credits

Full provenance, licensing notes and limitations: **docs/AUDIO_PROVENANCE.md**.

| File | What it is | Origin |
|---|---|---|
| `medihome-night-sanctuary.ogg` | Background music "Night Sanctuary" (Opus, 96 kb/s, 130 s: a 128 s seamless loop plus 1 s either side) | Original composition and synthesis for MediHome, `scripts/audio/night-sanctuary.js`, rendered and encoded by `scripts/audio/build-audio.mjs` |
| `medihome-night-sanctuary.aac` | The same music as AAC-LC 128 kb/s (fallback for browsers without Opus) | As above |

No third-party audio, samples, recordings or sound libraries are used. The flute is a synthesised flute-like voice,
not a recording. There is no nature ambience (see the provenance file for why). Interface cues are synthesised live
by `lib/sound/cues.ts`, and Ratchet's voice is the visitor's own browser speech engine. Neither ships an audio file.

Measured from the build (whole loop, decoded Opus file):
- average level -19.7 dBFS, peak -3.1 dBFS (the site plays it at 25% gain by default, about -32 dBFS);
- spectral flatness 4.6e-11 (clean tones). The previous noise-based version measured 7.8e-5, about a million
  times more noise-like;
- energy above 6 kHz -123 dB; the loudest single-frame high-frequency burst -104 dB (no clicks);
- the loop point jumps less than ordinary sample-to-sample movement in the music (0.008 vs up to 0.035).

If audio files are ever added here, list each with its creator, source and licence, and update the provenance file.
