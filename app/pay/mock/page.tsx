import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Mock() {
  return (
    <div style={{ maxWidth: 440 }}>
      <div className="bk-head">
        <span className="bk-logo">bKash</span>
        <span>Demo payment</span>
      </div>

      <div className="banner warn" style={{ marginTop: 12 }}>
        <b>DEMO ONLY — NO REAL PAYMENT</b>
        <p>No money will be sent or received. This page does not verify
        payments or activate bookings or subscriptions.</p>
      </div>

      <h1 style={{ marginTop: 12 }}>bKash Demo</h1>

      <div className="card" style={{ marginTop: 12 }}>
        <p>This is a visual demonstration of the MediHome payment interface.</p>
        <p>No real bKash account or transaction is involved.</p>
        <Link className="btn em" href="/dashboard">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
