import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Demo mode: manual payments are disabled. No money was received." },
    { status: 410 }
  );
}
