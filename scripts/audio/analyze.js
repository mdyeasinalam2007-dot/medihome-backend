// Audio measurements used by build-audio.mjs (runs in the browser): loudness, peaks, sample steps, noise-likeness
// (spectral flatness: ~0 for clean tones, towards 1 for noise or static) and how much energy sits above 6 kHz.
window.fft = (re, im) => { // in-place radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i+k], ui = im[i+k], vr = re[i+k+len/2]*cr - im[i+k+len/2]*ci, vi = re[i+k+len/2]*ci + im[i+k+len/2]*cr;
      re[i+k] = ur + vr; im[i+k] = ui + vi; re[i+k+len/2] = ur - vr; im[i+k+len/2] = ui - vi; const t = cr*wr - ci*wi; ci = cr*wi + ci*wr; cr = t; } } } };
window.analyze = (buf, from = 0, to = buf.duration) => {
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const a = Math.floor(from * sr), b = Math.min(L.length, Math.floor(to * sr));
  let peak = 0, sum = 0, maxStep = 0;
  for (let i = a; i < b; i++) { const m = (L[i] + R[i]) / 2; sum += m * m; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); if (i > a) maxStep = Math.max(maxStep, Math.abs(L[i] - L[i-1])); }
  const N = 4096, win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  const flats = [], lo = Math.ceil(60 * N / sr), hi = Math.floor(12000 * N / sr), hf = Math.floor(6000 * N / sr);
  let eAll = 0, eHf = 0, hfMax = 0;
  for (let s = a; s + N <= b; s += N) {
    const re = new Float64Array(N), im = new Float64Array(N); let fr = 0;
    for (let i = 0; i < N; i++) { const m = (L[s+i] + R[s+i]) / 2; re[i] = m * win[i]; fr += m*m; }
    if (Math.sqrt(fr / N) < 1e-3) continue; // skip near-silence
    fft(re, im);
    let lg = 0, ar = 0, cnt = 0, fAll = 0, fHf = 0;
    for (let k = lo; k <= hi; k++) { const p = re[k]*re[k] + im[k]*im[k] + 1e-20; lg += Math.log(p); ar += p; cnt++; if (k >= hf) { eHf += p; fHf += p; } eAll += p; fAll += p; }
    hfMax = Math.max(hfMax, fHf / (fAll || 1));
    flats.push(Math.exp(lg / cnt) / (ar / cnt));
  }
  flats.sort((x, y) => x - y);
  const db = (x) => +(20 * Math.log10(x + 1e-12)).toFixed(1);
  return { rmsDb: db(Math.sqrt(sum / (b - a))), peakDb: db(peak), maxSampleStep: +maxStep.toFixed(4),
    flatnessMedian: +(flats[flats.length >> 1] ?? 0).toExponential(2), flatness90: +(flats[Math.floor(flats.length * 0.9)] ?? 0).toExponential(2),
    above6kDb: +(10 * Math.log10(eHf / (eAll || 1) + 1e-30)).toFixed(1),
    worstFrameAbove6kDb: +(10 * Math.log10(hfMax + 1e-30)).toFixed(1) }; // a click shows up as one frame with a burst of high-frequency energy
};
