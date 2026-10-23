import { db } from "./db";

// Sessions are JWTs (no server-side session rows), so they can't be deleted. Instead, a password change
// (or account deletion) writes an audit entry, and any session that signed in BEFORE that moment is rejected.
// No database schema change is needed: the AuditLog table and its (entity, entityId) index already exist.
export const REVOKING_ACTIONS = ["PASSWORD_CHANGED", "ACCOUNT_DELETED"];

// authAt = when this session signed in (ms). Sessions created before this feature have no authAt: treated as 0.
export const isRevoked = (authAt: unknown, changedAt: Date | null | undefined) =>
  !!changedAt && changedAt.getTime() > (typeof authAt === "number" ? authAt : 0);

export async function lastRevocation(userId: string): Promise<Date | null> {
  const r = await db.auditLog.findFirst({
    where: { entity: "User", entityId: userId, action: { in: REVOKING_ACTIONS } },
    orderBy: { createdAt: "desc" }, select: { createdAt: true },
  });
  return r?.createdAt ?? null;
}
