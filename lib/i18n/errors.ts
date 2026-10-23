import type { Dict, Lang } from "./dictionaries";

// The API answers in English. Map the messages patients can actually see to translated text.
// Unknown messages: shown as-is in English, replaced by a generic message in Bangla.
const MAP: [RegExp, keyof Dict["errs"]][] = [
  // Ratchet AI (before the generic "too many" rule)
  [/AI service is not available right now/i, "aiUnavailable"],
  [/Ratchet is busy right now/i, "aiBusy"],
  [/used up its (free )?usage allowance/i, "aiQuotaDay"],
  [/getting too many requests right now/i, "aiQuotaMinute"],
  [/sending messages too quickly/i, "userRateMinute"],
  [/limit of 300 Ratchet messages/i, "userRateDay"],
  [/declined to analyse this content/i, "aiBlocked"],
  // password reset codes and account deletion (checked first: "too many" also matches the generic rule)
  [/incorrect code/i, "otpWrong"],
  [/code has expired|no longer valid/i, "otpExpired"],
  [/too many incorrect attempts/i, "otpTooMany"],
  [/6-digit code/i, "otpFormat"],
  [/password is not correct/i, "wrongPassword"],
  [/sign in again before deleting/i, "reauth"],
  [/password reset has expired|was already used/i, "badLink"],
  // hospital portal (checked first: some of these also contain words matched below)
  [/not enough units in stock/i, "noStock"],
  [/only new requests can be confirmed/i, "cannotChange"],
  [/subscription has expired/i, "subExpired"],
  [/suspended/i, "suspended"],
  [/awaiting approval/i, "awaitingApproval"],
  [/already active until/i, "alreadyActive"],
  [/just renewed/i, "justRenewed"],
  [/cannot exceed total/i, "availOverTotal"],
  [/must be a non-negative number/i, "badNumber"],
  [/^\w+ is required$/i, "fieldMissing"],
  [/slot (was|is) (just |already )?taken|someone else just booked/i, "slotTaken"],
  [/no units available|not listed as available|not enough units|this ambulance is not available|not available any more/i, "noUnits"],
  [/can't be changed|can no longer be cancelled|not awaiting payment|cannot be rejected/i, "cannotChange"],
  [/booking not found/i, "notFound"],
  [/please sign in/i, "signIn"],
  [/too many/i, "tooMany"],
  [/not accepted this request/i, "notAccepted"],
  [/phone number is already used/i, "phoneTaken"],
  [/name required/i, "nameRequired"],
  [/already registered/i, "emailTaken"],
  [/valid email and a password/i, "regInvalid"],
  [/hospital name, address, phone/i, "hospitalFields"],
  [/service name, area and phone/i, "ambulanceFields"],
  [/enter a valid email/i, "badEmail"],
  [/at least 8 characters/i, "shortPw"],
  [/reset link (is invalid|was already used)/i, "badLink"],
];
export function apiError(t: Dict, lang: Lang, msg?: string, fallback?: string): string {
  const m = String(msg || "");
  const hit = MAP.find(([re]) => re.test(m));
  if (hit) return t.errs[hit[1]];
  return lang === "en" && m ? m : fallback || t.acts.failed;
}
