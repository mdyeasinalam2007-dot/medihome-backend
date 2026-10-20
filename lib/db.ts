import { PrismaClient } from "@prisma/client";

const DEFAULT_DATABASE_URL =
  "postgresql://neondb_owner:npg_Ndicua8AlQ0Z@ep-blue-grass-a1zvq6rn-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
