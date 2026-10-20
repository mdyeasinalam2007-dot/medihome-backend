import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    { error: "Demo mode: payment verification and approval are disabled." },
    { status: 410 }
  );
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}
