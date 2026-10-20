"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
export default function Reset() {
  const [q, setQ] = useState({ token: "", email: "" }), [pw, setPw] = useState(""), [pw2, setPw2] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  useEffect(() => { const p = new URLSearchParams(window.location.search); setQ({ token: p.get("token") || "", email: p.get("email") || "" }); }, []);
  async function go(e: any) {
    e.preventDefault(); if (pw !== pw2) return toast("The two passwords do not match", "err");
    setBusy(true); const r = await fetch("/api/password/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...q, password: pw }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return toast(j.error || "Could not reset password", "err"); setDone(true); setTimeout(() => (window.location.href = "/login"), 2000);
  }
  if (!q.token) return <div style={{ maxWidth: 420 }}><h1>Reset <em>password</em></h1><div className="banner warn" style={{ marginTop: 12 }}>This page needs the link from your email. <Link href="/forgot-password" style={{ fontWeight: 700 }}>Request a new link</Link></div></div>;
  return <div style={{ maxWidth: 420 }}><h1>Choose a new <em>password</em></h1>
    {done ? <div className="banner ok" style={{ marginTop: 12 }}>Password changed. Taking you to sign in…</div> :
      <form className="card" onSubmit={go} style={{ marginTop: 14 }}>
        <label htmlFor="np">New password (8+ characters)</label><input id="np" type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <label htmlFor="np2">Repeat new password</label><input id="np2" type="password" minLength={8} required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        <button className="btn" style={{ width: "100%", marginTop: 14 }} disabled={busy}>{busy ? "Saving…" : "Change password"}</button></form>}</div>;
}
