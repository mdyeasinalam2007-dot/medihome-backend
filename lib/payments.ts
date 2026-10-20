export async function startPayment(a: {
  purpose: "BOOKING" | "REGISTRATION" | "SUBSCRIPTION" | "AMBULANCE_FEE";
  amount: number;
  userId: string;
  hospitalId?: string;
  bookingId?: string;
  ambulanceBookingId?: string;
}) {
  // Visual demo only. No payment row, provider request, or money transfer.
  const id = "DEMO" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return {
    paymentId: id,
    url: `/pay/mock?paymentID=${encodeURIComponent(id)}`,
  };
}

export async function settlePayment(): Promise<never> {
  throw new Error("Demo mode: real payment settlement is disabled.");
}
