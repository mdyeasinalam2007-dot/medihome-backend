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
