import { NextResponse } from "next/server";
import { handle, needUser, HttpError, limit } from "@/lib/guard";
import { verifyToken, consume } from "@/lib/aitoken";
import { POST as createBooking } from "@/app/api/bookings/route"; // the EXISTING booking + payment logic. No second booking system.

// Step 2: runs only after the patient pressed "Confirm" on the review screen.
export const POST = handle(async (req) => {
  const u = await needUser("PATIENT"); limit("aibook:" + u.id, 6, 60_000);
  const { token } = await req.json().catch(() => ({}));
  const p = verifyToken(token);
  if (!p || p.uid !== u.id) throw new HttpError(400, "This confirmation expired or is invalid. Please review the booking again.");
  if (!consume(p.jti)) throw new HttpError(409, "This confirmation was already used.");
  const res = await createBooking(new Request(new URL("/api/bookings", req.url), { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "DOCTOR", hospitalId: p.hospitalId, itemId: p.doctorId, date: p.date, time: p.time }) }), {}); // availability is re-validated here, on the server
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, j.error || "Booking failed");
  return NextResponse.json({ bookingId: j.bookingId, payUrl: j.url, status: "AWAITING_PAYMENT" });
});
