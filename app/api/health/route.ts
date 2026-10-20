import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasDbUrl = Boolean(process.env.DATABASE_URL);
  const dbUrlPreview = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@")
    : null;

  let dbStatus = "unknown";
  let dbError: any = null;
  let stats: any = null;

  try {
    const [hospitals, doctors] = await Promise.all([
      db.hospital.count(),
      db.doctor.count(),
    ]);
    dbStatus = "connected";
    stats = { hospitals, doctors };
  } catch (err: any) {
    dbStatus = "error";
    dbError = {
      name: err?.name,
      message: err?.message,
      code: err?.code,
    };
  }

  return NextResponse.json({
    status: dbStatus === "connected" ? "healthy" : "degraded",
    environment: process.env.NODE_ENV,
    renderUrl: process.env.RENDER_EXTERNAL_URL || null,
    nextAuthUrl: process.env.NEXTAUTH_URL || null,
    database: {
      configured: hasDbUrl,
      preview: dbUrlPreview,
      status: dbStatus,
      stats,
      error: dbError,
    },
    timestamp: new Date().toISOString(),
  });
}
