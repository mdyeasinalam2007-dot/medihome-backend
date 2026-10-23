import { NextResponse } from "next/server";
import { db, dbConfigError } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public health check: reveals only ok / error. Diagnostics go to the server log, never to the response.
export async function GET() {
  let ok = false;
  const problem = dbConfigError();
  if (problem) console.error("[health] " + problem);
  else {
    try { await db.$queryRaw`SELECT 1`; ok = true; }
    catch (e: any) { console.error("[health] database check failed:", e?.name || "error", e?.code || e?.errorCode || ""); }
  }
  return NextResponse.json({ status: ok ? "ok" : "error" }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
