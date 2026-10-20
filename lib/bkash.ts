export const paymentMode = () => "mock";

export async function createPayment(a: {
  amount: number;
  invoice: string;
  payerRef: string;
  callbackURL: string;
}) {
  const id = "DEMO" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return {
    paymentID: id,
    url: `/pay/mock?paymentID=${encodeURIComponent(id)}`,
  };
}

export async function executePayment(_paymentID: string, _expectedAmount: number) {
  return { ok: false, trxID: undefined };
}
