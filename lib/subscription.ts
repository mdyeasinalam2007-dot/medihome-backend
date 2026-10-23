export function effectiveStatus(h: { subStatus: string; subExpiresAt: Date | null }, now = new Date()) {
  if (h.subStatus === "ACTIVE" && (!h.subExpiresAt || h.subExpiresAt <= now)) return "PAST_DUE";
  return h.subStatus;
}
export const isActive = (h: any, now = new Date()) => effectiveStatus(h, now) === "ACTIVE";
export const activeWhere = () => ({ subStatus: "ACTIVE" as const, subExpiresAt: { gt: new Date() } });
export function extendExpiry(cur: Date | null, now = new Date()) {
  const base = cur && cur > now ? cur : now;
  const d = new Date(base); d.setDate(d.getDate() + 30); return d;
}

// ---- Administrator approval ----
// A hospital is "approved" only after an administrator sets subStatus to ACTIVE (see /owner).
// New registrations start as PENDING_VERIFICATION. Legacy PENDING_PAYMENT rows are treated as not approved.
// Public listings use activeWhere(), so pending / suspended hospitals are never shown.
export const NEW_HOSPITAL_STATUS = "PENDING_VERIFICATION" as const;
export const isApproved = (h: { subStatus: string }) => h.subStatus === "ACTIVE";

// Demo renewal is allowed only for approved hospitals, and only when the subscription has expired
// or ends within RENEW_WINDOW_DAYS. This stops anyone stacking free months by clicking repeatedly.
export const RENEW_WINDOW_DAYS = 7;
export const renewOpensAt = (expires: Date) => new Date(expires.getTime() - RENEW_WINDOW_DAYS * 86_400_000);
export function canRenew(h: { subStatus: string; subExpiresAt: Date | null }, now = new Date()) {
  if (!isApproved(h)) return false;
  return !h.subExpiresAt || renewOpensAt(h.subExpiresAt) <= now;
}

// Human-readable reason a hospital may not publish / accept bookings. null = allowed.
export function inactiveReason(h: { subStatus: string; subExpiresAt: Date | null }, now = new Date()): { status: number; message: string } | null {
  const s = effectiveStatus(h, now);
  if (s === "ACTIVE") return null;
  if (s === "SUSPENDED") return { status: 403, message: "This hospital account is suspended. Please contact MediHome support." };
  if (s === "PAST_DUE") return { status: 402, message: "Your subscription has expired. Renew it from the Billing tab (demo mode: no payment is collected)." };
  return { status: 403, message: "Your hospital is awaiting approval by a MediHome administrator." };
}
