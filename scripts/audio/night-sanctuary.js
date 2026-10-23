/*
 * MediHome "Night Sanctuary": the site's background music.
 * Original composition and sound design written for MediHome (see docs/AUDIO_PROVENANCE.md).
 *
 * This file is the score AND the synthesiser. It runs in a browser (OfflineAudioContext) and is rendered once by
 * scripts/audio/build-audio.mjs into public/audio/. Visitors download the rendered file, not this code.
 *
 * Sound sources: sine waves only (pads, overtones, flute-like voice). No noise generators, no samples, no
 * recordings. The only noise anywhere is inside the reverb's impulse response, which (like any reverb) only
 * shapes the decay of the tones that pass through it.
 *
 * Form: a 128 s loop of eight 16 s chords in D-flat major. The piece is rendered twice back to back and the second
 * pass is kept (with 1 s of extra audio either side), so every tail that crosses the loop point is already
 * in the file: the loop is seamless by construction.
 */
(function () {
  const LOOP = 128; // seconds; also lib/sound/assets.ts MUSIC.loopLength
  const PAD = 1; //    seconds of extra audio before and after the loop; also MUSIC.loopStart
  const CHORD = 16;
  const ATTACK = 6, RELEASE = 8;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Harmony (MIDI note numbers). Warm middle register, smooth voice-leading; shared notes are held across chords.
  const CHORDS = [
    [49, 56, 60, 63, 65], // Dbmaj9        Db3 Ab3 C4 Eb4 F4
    [46, 53, 56, 60, 61], // Bbm9          Bb2 F3 Ab3 C4 Db4
    [42, 49, 53, 56, 58], // Gbmaj9        Gb2 Db3 F3 Ab3 Bb3
    [44, 51, 58, 60, 63], // Ab add9       Ab2 Eb3 Bb3 C4 Eb4
    [41, 48, 56, 63, 67], // Fm9 (open)    F2 C3 Ab3 Eb4 G4
    [46, 53, 56, 61, 63], // Bbm11         Bb2 F3 Ab3 Db4 Eb4
    [42, 49, 53, 58, 60], // Gbmaj7#11     Gb2 Db3 F3 Bb3 C4
    [44, 51, 54, 61, 63], // Ab9sus4       Ab2 Eb3 Gb3 Db4 Eb4  -> back to Db
  ];

  // Flute phrases: [start offset s, MIDI note, length s]. Written for this piece; sparse, unhurried, mostly falling
  // to rest. Each phrase is played legato in one breath.
  const PHRASES = [
    { at: 8.0, notes: [[0, 68, 1.4], [1.6, 65, 0.9], [2.7, 63, 3.4]] }, //                               over Dbmaj9
    { at: 36.0, notes: [[0, 70, 1.2], [1.4, 73, 1.6], [3.2, 72, 0.7], [4.1, 70, 1.0], [5.3, 68, 3.4]] }, // Gbmaj9
    { at: 66.0, notes: [[0, 72, 1.4], [1.6, 75, 2.0], [3.9, 72, 0.8], [4.9, 68, 0.9], [6.0, 67, 1.0], [7.2, 65, 3.6]] }, // Fm9
    { at: 100.0, notes: [[0, 77, 1.8], [2.0, 75, 1.0], [3.2, 73, 1.2], [4.6, 70, 2.8]] }, //            Gbmaj7#11
    { at: 110.5, notes: [[0, 68, 1.0], [1.2, 70, 0.7], [2.1, 63, 4.0]] }, //                              into Ab9sus4
  ];

  // Mix (linear). Tuned by measurement in build-audio.mjs.
  const MIX = { pad: 0.05, shimmer: 0.011, flute: 0.05 };
  const SEND = { pad: 0.3, shimmer: 0.9, flute: 0.55 };

  // Deterministic random numbers (only used for the reverb), so every build is identical.
  function prng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // A soft, dark hall: a 4.8 s stereo decay that gets darker as it fades, with a 22 ms pre-delay.
  function impulse(ctx, seconds) {
    const sr = ctx.sampleRate, len = Math.floor(sr * seconds), pre = Math.floor(sr * 0.022), rnd = prng(20261024);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let y1 = 0, y2 = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / sr, a = 0.12 * Math.exp(-t / 1.6) + 0.035; // low-pass that closes over time
        y1 += a * ((rnd() * 2 - 1) - y1); y2 += a * (y1 - y2);
        d[i] = y2 * Math.exp((-6.9 * t) / (seconds - 0.022)) * Math.min(1, (i - pre) / (sr * 0.006));
      }
    }
    return buf;
  }

  const rise = (lvl, n = 128) => Float32Array.from({ length: n }, (_, i) => lvl * (0.5 - 0.5 * Math.cos((Math.PI * i) / (n - 1))));
  const fall = (lvl, n = 128) => Float32Array.from({ length: n }, (_, i) => lvl * (0.5 + 0.5 * Math.cos((Math.PI * i) / (n - 1))));

  /**
   * Renders the piece. `stems` scales each layer (for measuring them separately). Returns an AudioBuffer of
   * LOOP + 2*PAD seconds. Audio nodes are created just before they are needed (the offline render pauses every few
   * seconds to add them), which keeps rendering fast.
   */
  async function render(sampleRate = 48000, stems = { pad: 1, shimmer: 1, flute: 1 }) {
    // Two passes are enough: the second pass (plus PAD either side) already contains every tail from the first.
    const total = 2 * LOOP + PAD + 0.5;
    const ctx = new OfflineAudioContext(2, Math.ceil(total * sampleRate), sampleRate);
    const master = ctx.createGain(); master.connect(ctx.destination);
    const reverb = ctx.createConvolver(); reverb.buffer = impulse(ctx, 4.8);
    const wet = ctx.createGain(); wet.gain.value = 0.9; reverb.connect(wet); wet.connect(master);
    const bus = (send, level) => {
      const g = ctx.createGain(); g.gain.value = level; g.connect(master);
      const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(reverb); return g;
    };
    const padBus = bus(SEND.pad, stems.pad ?? 1), shimBus = bus(SEND.shimmer, stems.shimmer ?? 1), fluteBus = bus(SEND.flute, stems.flute ?? 1);
    const side = (pan) => { const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(padBus); return p; };
    const padL = side(-0.55), padR = side(0.55);
    // the pad's centre tone: fundamental plus a little 2nd and 3rd harmonic, in one waveform
    const warm = ctx.createPeriodicWave(new Float32Array(4), Float32Array.from([0, 1, 0.115, 0.036]), { disableNormalization: true });

    const events = []; // [time, build()]: nodes are built just before `time`
    const mod = (i) => ((i % 8) + 8) % 8;

    // ---- pads: one voice per held note ----
    for (let i = 0; i < 3 * 8; i++) {
      const chord = CHORDS[mod(i)], prev = CHORDS[mod(i - 1)];
      chord.forEach((m, v) => {
        if (i > 0 && prev.includes(m)) return; // held over from the previous chord
        let j = i; while (j < i + 7 && CHORDS[mod(j + 1)].includes(m)) j++;
        const t0 = i * CHORD, t1 = (j + 1) * CHORD;
        if (t0 < total) events.push([t0, () => padNote(m, v, t0, t1)]);
      });
    }
    // Envelope with slow "breathing" folded in: a 6 s rise, a gently swelling hold, an 8 s fall. The breathing
    // depends on absolute time with periods that divide the loop, so it loops too.
    function envCurve(lvl, t0, t1, m) {
      const step = 0.1, n = Math.ceil((t1 + RELEASE - t0) / step) + 1, k = [7, 9, 11, 13][m % 4], ph = (m * 1.7) % (2 * Math.PI);
      return Float32Array.from({ length: n }, (_, i) => {
        const t = t0 + i * step, a = t - t0;
        const shape = a < ATTACK ? 0.5 - 0.5 * Math.cos((Math.PI * a) / ATTACK) : t <= t1 ? 1 : t >= t1 + RELEASE ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (t - t1)) / RELEASE);
        return lvl * shape * (1 + 0.07 * Math.sin((2 * Math.PI * k * t) / LOOP + ph));
      });
    }
    function padNote(m, v, t0, t1) {
      const f = hz(m), lvl = MIX.pad * (v === 0 ? 0.95 : v === 4 ? 0.6 : 0.75), end = t1 + RELEASE;
      // a warm centre tone plus two faint, barely detuned pure copies left and right (slow, gentle width)
      for (const [out, cents, amount, w] of [[padBus, 0, 0.7, warm], [padL, 1.1, 0.07, null], [padR, -1.1, 0.07, null]]) {
        const o = ctx.createOscillator(); if (w) o.setPeriodicWave(w); o.frequency.value = f; o.detune.value = cents;
        const env = ctx.createGain(); env.gain.value = 0;
        const c = envCurve(lvl * amount, t0, t1, m); env.gain.setValueCurveAtTime(c, t0, (c.length - 1) * 0.1);
        o.connect(env); env.connect(out); o.start(t0); o.stop(end + 0.05);
      }
    }

    // ---- overtones: the two upper chord tones two octaves up, very faint, drifting across the stereo field ----
    for (let i = 0; i < 3 * 8; i++) {
      const chord = CHORDS[mod(i)];
      [chord[3], chord[4]].forEach((m, k) => {
        const t0 = i * CHORD + 3 + k * 2.5;
        if (t0 < total) events.push([t0, () => {
          const o = ctx.createOscillator(); o.frequency.value = hz(m + 24);
          const env = ctx.createGain(); env.gain.value = 0;
          env.gain.setValueCurveAtTime(rise(MIX.shimmer * (k ? 0.7 : 1)), t0, 5);
          env.gain.setValueCurveAtTime(fall(MIX.shimmer * (k ? 0.7 : 1)), t0 + 7, 6);
          const p = ctx.createStereoPanner(), s = k ? 1 : -1;
          p.pan.setValueAtTime(-0.6 * s, t0); p.pan.linearRampToValueAtTime(0.6 * s, t0 + 13);
          o.connect(env); env.connect(p); p.connect(shimBus); o.start(t0); o.stop(t0 + 13.1);
        }]);
      });
    }

    // ---- flute-like voice: additive tone, legato glides, a small upward "scoop" into each phrase, delayed vibrato ----
    for (let pass = 0; pass < 3; pass++) for (const ph of PHRASES) { const t = pass * LOOP + ph.at; if (t < total) events.push([t, () => flutePhrase(t, ph.notes)]); }
    function flutePhrase(t, notes) {
      const end = t + notes[notes.length - 1][0] + notes[notes.length - 1][2];
      const amp = ctx.createGain(); amp.gain.value = 0;
      const pan = ctx.createStereoPanner(); pan.pan.value = 0.18; amp.connect(pan); pan.connect(fluteBus);
      const vib = ctx.createOscillator(); vib.frequency.value = 5.1;
      const vibDepth = ctx.createGain(); vibDepth.gain.value = 0; vib.connect(vibDepth);
      const harm = [[1, 1], [2, 0.2], [3, 0.075], [4, 0.025]];
      const oscs = harm.map(([h, g]) => {
        const o = ctx.createOscillator(); const gn = ctx.createGain(); gn.gain.value = g;
        o.connect(gn); gn.connect(amp); vibDepth.connect(o.detune); return { o, h, gn, g };
      });
      notes.forEach(([off, m, dur], k) => {
        const s = t + off, f = hz(m);
        for (const { o, h, gn, g } of oscs) {
          if (k === 0) { o.frequency.setValueAtTime(f * h * Math.pow(2, -38 / 1200), s); o.frequency.setTargetAtTime(f * h, s + 0.01, 0.05); }
          else o.frequency.setTargetAtTime(f * h, s, 0.028); // legato slide into the next note
          if (h === 2) { gn.gain.setTargetAtTime(g * 1.6, s, 0.012); gn.gain.setTargetAtTime(g, s + 0.05, 0.06); } // a little brightness at each onset (glided: a step would click)
        }
        // vibrato: none at the start of a note, then a gentle 5 Hz waver on held notes
        const depth = dur > 2 ? 13 : 8;
        vibDepth.gain.setTargetAtTime(0, s, 0.03);
        vibDepth.gain.setTargetAtTime(depth, s + Math.min(0.45, dur * 0.4), 0.25);
        // breath shape: soft attack, slight articulation between notes, a gentle swell on long notes
        if (k === 0) { amp.gain.setValueAtTime(0, s); amp.gain.setTargetAtTime(MIX.flute * 0.85, s, 0.07); }
        else { amp.gain.setTargetAtTime(MIX.flute * 0.62, s - 0.02, 0.02); amp.gain.setTargetAtTime(MIX.flute * 0.85, s + 0.05, 0.06); }
        if (dur > 2) amp.gain.setTargetAtTime(MIX.flute, s + 0.4, dur * 0.3);
      });
      amp.gain.setTargetAtTime(0, end - 0.35, 0.22); // the breath runs out softly
      for (const { o } of oscs) { o.start(t); o.stop(end + 1.5); }
      vib.start(t); vib.stop(end + 1.5);
    }

    // Build nodes in 4 s batches: everything starting in [s, s + 4) is created while the render is paused at s.
    events.sort((a, b) => a[0] - b[0]);
    const STEP = 4; let next = 0;
    const buildUntil = (until) => { while (next < events.length && events[next][0] < until) events[next++][1](); };
    buildUntil(STEP);
    for (let s = STEP; s < total; s += STEP) {
      const at = s;
      ctx.suspend(at).then(() => { buildUntil(at + STEP); return ctx.resume(); });
    }

    const full = await ctx.startRendering();
    // keep the second pass plus PAD seconds either side (all tails included, so it loops seamlessly)
    const a = Math.round((LOOP - PAD) * sampleRate), n = Math.round((LOOP + 2 * PAD) * sampleRate);
    const out = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate });
    for (let ch = 0; ch < 2; ch++) out.getChannelData(ch).set(full.getChannelData(ch).subarray(a, a + n));
    return out;
  }

  window.NightSanctuary = { LOOP, PAD, render, MIX };
})();
