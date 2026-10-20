"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
export default function Forgot() {
  const [email, setEmail] = useState(""), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  async function go(e: any) {
    e.preventDefault(); setBusy(true);
    const r = await fetch("/api/password/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return toast(j.error || "Something went wrong", "err"); setMsg(j.message);
  }
  const local = typeof window !== "undefined" && window.location.hostname === "localhost";
  return <div style={{ maxWidth: 420 }}><h1>Forgot <em>password</em></h1>
    <p className="sub">Enter your email. If it belongs to a password account we will send a reset link.</p>
    <form className="card" onSubmit={go}>
      <label htmlFor="fe">Email</label><input id="fe" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn" style={{ width: "100%", marginTop: 14 }} disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
      {msg && <div className="banner ok" style={{ marginTop: 12 }}>{msg}</div>}
      {msg && local && <div className="banner info">Running on localhost? If no email service is configured, the link is printed in the terminal window where <b>npm run dev</b> is running.</div>}
      <p style={{ marginTop: 12, fontSize: 13 }}><Link href="/login" style={{ color: "var(--blue)", fontWeight: 700 }}>Back to sign in</Link></p>
    </form></div>;
}
