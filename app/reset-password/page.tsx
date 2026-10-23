"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { useI18n } from "@/components/I18nProvider";
import { apiError } from "@/lib/i18n/errors";

// Same API as before: POST /api/password/reset with the emailed token (single use; signs out older sessions).
export default function Reset() {
  const { t, lang } = useI18n(); const a = t.auth;
  const [q, setQ] = useState({ token: "", email: "" }), [pw, setPw] = useState(""), [pw2, setPw2] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [err, setErr] = useState("");
  useEffect(() => { const p = new URLSearchParams(window.location.search); setQ({ token: p.get("token") || "", email: p.get("email") || "" }); }, []);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (pw !== pw2) { setErr(a.mismatch); return; }
    setBusy(true); const r = await fetch("/api/password/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...q, password: pw }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setErr(apiError(t, lang, j.error)); return; }
    setDone(true); setTimeout(() => (window.location.href = "/login"), 2000);
  }
  if (!q.token) return <AuthShell title={a.resetTitle}><div className="card auth-card"><div className="banner warn">{a.resetNeedLink}</div>
    <p className="auth-alt"><Link href="/forgot-password" className="link">{a.requestNew}</Link></p></div></AuthShell>;
  const inv = err === a.mismatch ? { "aria-invalid": true as const, "aria-describedby": "rp-err" } : {};
  return <AuthShell title={a.resetTitle}>
    {done ? <div className="card auth-card"><div className="banner ok" role="status">{a.changed}</div></div> :
      <form className="card auth-card" onSubmit={go}>
        {err && <div className="banner warn" role="alert" id="rp-err">{err}</div>}
        <label htmlFor="np">{a.newPw}</label><input id="np" type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <label htmlFor="np2">{a.repeatPw}</label><input id="np2" type="password" minLength={8} required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} {...inv} />
        <button className="btn auth-submit" disabled={busy} aria-busy={busy || undefined}>{busy ? a.saving : a.change}</button>
      </form>}
  </AuthShell>;
}
