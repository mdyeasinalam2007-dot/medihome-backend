import { NextResponse } from "next/server";
import { handle, needUser, limit } from "@/lib/guard";
import { prepareBooking } from "@/lib/aitools";
export const POST = handle(async (req) => {
  const u = await needUser("PATIENT"); limit("aiprep:" + u.id, 20, 60_000);
  return NextResponse.json(await prepareBooking(u.id, await req.json().catch(() => ({}))));
});
