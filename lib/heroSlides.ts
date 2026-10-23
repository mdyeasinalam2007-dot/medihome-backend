// Homepage hero slideshow: 30 male doctor portraits and 30 medical equipment photos, stored locally under
// public/images/ (sources and licences in public/images/CREDITS.md). Shown in a fresh random order every cycle.

export type EquipmentKind =
  | "mri" | "mriScan" | "imagingWorkstation" | "ct" | "xray" | "radiotherapy" | "ultrasound" | "patientMonitor"
  | "ecg" | "anesthesia" | "ventilator" | "defibrillator" | "surgicalLights" | "surgicalMicroscope"
  | "operatingRoom" | "surgicalInstruments" | "microscope" | "bloodPressure" | "ivDrip" | "stethoscope";
export type EquipmentAlt = Record<EquipmentKind, string>;

// No `equipment` key = doctor portrait.
export type Slide = { src: string; equipment?: EquipmentKind };

const pad = (n: number) => String(n).padStart(2, "0");
const doctors: Slide[] = Array.from({ length: 30 }, (_, i) => ({ src: `/images/doctors/doctor-${pad(i + 1)}.jpg` }));
const eq = (kind: EquipmentKind, file: string, n: number): Slide => ({ src: `/images/equipment/equipment-${file}-${pad(n)}.jpg`, equipment: kind });
const equipment: Slide[] = [
  eq("mri", "mri", 1), eq("mri", "mri", 2), eq("mriScan", "mri-scan", 1), eq("imagingWorkstation", "imaging-workstation", 1),
  eq("ct", "ct", 1), eq("ct", "ct", 2), eq("xray", "xray", 1), eq("xray", "xray", 2), eq("radiotherapy", "radiotherapy", 1),
  eq("ultrasound", "ultrasound", 1), eq("ultrasound", "ultrasound", 2), eq("ultrasound", "ultrasound", 3),
  eq("patientMonitor", "patient-monitor", 1), eq("patientMonitor", "patient-monitor", 2), eq("patientMonitor", "patient-monitor", 3),
  eq("ecg", "ecg", 1), eq("ecg", "ecg", 2), eq("ecg", "ecg", 3),
  eq("anesthesia", "anesthesia", 1), eq("anesthesia", "anesthesia", 2), eq("ventilator", "ventilator", 1),
  eq("defibrillator", "defibrillator", 1), eq("surgicalLights", "surgical-lights", 1), eq("surgicalMicroscope", "surgical-microscope", 1),
  eq("operatingRoom", "operating-room", 1), eq("surgicalInstruments", "surgical-instruments", 1), eq("microscope", "microscope", 1),
  eq("bloodPressure", "blood-pressure", 1), eq("ivDrip", "iv-drip", 1), eq("stethoscope", "stethoscope", 1),
];

// Index 0 (a doctor) is the server-rendered first slide; everything after it is shuffled in the browser.
export const SLIDES: Slide[] = [...doctors, ...equipment];

const MAX_RUN = 2; // at most two doctors (or two machines) in a row while both kinds remain

function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * One cycle of the shuffle bag: every index in `pool` exactly once, in random order. Doctors and equipment are
 * drawn in proportion to what is left, never more than MAX_RUN of one kind in a row while the other kind remains,
 * so both are spread through the whole cycle. `prev` is the slide shown just before this cycle: it is never the
 * first slide of the new cycle, and it counts toward the run limit.
 */
export function buildCycle(pool: number[], prev: number | null, slides: Slide[] = SLIDES, rnd: () => number = Math.random): number[] {
  const isEq = (i: number) => slides[i].equipment !== undefined;
  const docs = shuffle(pool.filter((i) => !isEq(i)), rnd);
  const eqs = shuffle(pool.filter(isEq), rnd);
  // Never open a cycle with the slide that just ended the previous one.
  for (const bag of [docs, eqs]) if (bag.length > 1 && bag[bag.length - 1] === prev) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];

  const out: number[] = [];
  let lastEq = prev === null ? null : isEq(prev);
  let run = prev === null ? 0 : 1;
  while (docs.length || eqs.length) {
    let takeEq: boolean;
    if (!docs.length) takeEq = true;
    else if (!eqs.length) takeEq = false;
    else if (run >= MAX_RUN && lastEq !== null) takeEq = !lastEq;
    else takeEq = rnd() < eqs.length / (eqs.length + docs.length);
    const next = (takeEq ? eqs : docs).pop()!;
    if (next === prev && out.length === 0) { // only possible when this kind has a single slide left; take the other kind
      const other = takeEq ? docs : eqs;
      if (other.length) { (takeEq ? eqs : docs).push(next); out.push(other.pop()!); lastEq = !takeEq; run = 1; continue; }
    }
    out.push(next);
    run = lastEq === takeEq ? run + 1 : 1;
    lastEq = takeEq;
  }
  return out;
}
