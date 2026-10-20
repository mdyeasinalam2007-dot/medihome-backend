import { db } from "./db";
export const audit = (d: { actorId?: string; hospitalId?: string; action: string; entity: string; entityId?: string; meta?: any }) =>
  db.auditLog.create({ data: d }).catch(() => null);
