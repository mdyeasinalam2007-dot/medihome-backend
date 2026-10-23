import { PrismaClient } from "@prisma/client";
import { dbConfigError } from "./dbConfig";
export { dbConfigError };

// No hardcoded fallback: if DATABASE_URL is missing, log a clear message (never the value) and let queries
// fail. API routes then answer 503 "Service temporarily unavailable" (see lib/guard.ts).
const problem = dbConfigError();
if (problem) console.error("[config] " + problem);

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
