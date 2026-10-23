// Ratchet's voice: chosen from the voices the visitor's own browser/operating system provides (Web Speech API).
// Nothing is downloaded or recorded; the visitor's device speaks the text. Which voices exist depends on the device,
// so we rank known clear adult male English voices and fall back gracefully.

export const RATCHET_GREETING =
  "Hello, I’m Ratchet, your AI assistant. I’m here to help you navigate MediHome and answer your questions. How can I help you today?";

// Best first. Neural "Natural" voices (Microsoft Edge) sound the most human; then Google's and Apple's male voices;
// then the classic Windows voices, which are clear and a little synthetic (fitting for Ratchet).
const RANK: RegExp[] = [
  /\b(Andrew|Brian|Guy|Christopher|Eric|Roger|Steffan|Davis|Ryan|Thomas)\b.*(Natural|Neural)/i,
  /Google UK English Male/i,
  /\b(Daniel|Aaron|Arthur|Oliver|Gordon|Evan|Nathan|Tom|Alex|Rishi)\b/,
  /Microsoft Mark\b/i,
  /Microsoft David\b/i,
  /\bmale\b/i,
];
const FEMALE = /female|zira|aria|jenny|samantha|victoria|karen|moira|tessa|fiona|susan|hazel|libby|sonia|emma|ava|michelle|serena|google us english$/i;

export type VoiceChoice = { voice: SpeechSynthesisVoice | null; male: boolean; pitch: number; rate: number };

/** Picks Ratchet's voice and delivery settings from what the browser offers. */
export function pickRatchetVoice(voices: readonly SpeechSynthesisVoice[]): VoiceChoice {
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  for (const re of RANK) {
    const hits = en.filter((v) => re.test(v.name) && !FEMALE.test(v.name));
    if (hits.length) {
      const v = hits.find((x) => /^en[-_](US|GB)/i.test(x.lang)) || hits[0];
      // composed and steady: a touch slower than default, pitch very slightly lowered
      return { voice: v, male: true, pitch: 0.92, rate: 0.95 };
    }
  }
  // No known male voice on this device: use a non-female English voice if any, else the default, lowered a little.
  const v = en.find((x) => !FEMALE.test(x.name)) || en[0] || null;
  return { voice: v, male: false, pitch: 0.8, rate: 0.95 };
}
