"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { useI18n } from "@/components/I18nProvider";
import { apiError } from "@/lib/i18n/errors";
import { fill } from "@/lib/format";

// Forgot password, in three steps:
// 1) POST /api/password/forgot  { email }        -> emails a 6-digit code (same answer whether or not the email exists)
// 2) POST /api/password/verify  { email, code }  -> single-use code, attempt-limited; returns a short-lived reset ticket
// 3) POST /api/password/reset   { email, token: ticket, password } -> new password; signs out older sessions everywhere
const RESEND_S = 60;
export default function Forgot() {
  const { t, lang } = useI18n(); const a = t.auth;
  const [step, setStep] = useState<1 | 2 | 3>(1), [email, setEmail] = useState(""), [code, setCode] = useState(""), [ticket, setTicket] = useState("");
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [note, setNote] = useState(""), [wait, setWait] = useState(0), [done, setDone] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, [step]);
  useEffect(() => { if (wait <= 0) return; const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); }, [wait]);

  const post = async (url: string, body: any) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    return { ok: !!r?.ok, j, err: r ? apiError(t, lang, j.error) : t.acts.failed };
  };
  async function sendCode(e?: React.FormEvent, again = false) {
    e?.preventDefault(); setBusy(true); setErr(""); setNote("");
    const r = await post("/api/password/forgot", { email }); setBusy(false);
    if (!r.ok) { setErr(r.err); return; }
    setWait(RESEND_S); setCode("");
    if (again) setNote(a.codeResent); else setStep(2);
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await post("/api/password/verify", { email, code }); setBusy(false);
    if (!r.ok) { setErr(r.err); return; }
    setTicket(r.j.ticket); setStep(3);
  }
  async function reset(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (pw !== pw2) { setErr(a.mismatch); return; }
    setBusy(true); const r = await post("/api/password/reset", { email, token: ticket, password: pw }); setBusy(false);
    if (!r.ok) { setErr(r.err); return; }
    setDone(true); setTimeout(() => (window.location.href = "/login"), 2000);
  }
  const errBox = err && <div className="banner warn" role="alert" id="fp-err">{err}</div>;
  const inv = err ? { "aria-invalid": true as const, "aria-describedby": "fp-err" } : {};

  return <AuthShell title={step === 1 ? a.forgotTitle : step === 2 ? a.codeTitle : a.resetTitle}
    sub={step === 1 ? a.forgotSub : step === 2 ? fill(a.codeSub, { email }) : fill(a.newPwSub, { email })}>
    <p className="step-note" aria-live="polite">{fill(a.step, { n: step })}</p>
    {step === 1 && <form className="card auth-card" onSubmit={sendCode} noValidate>
      {errBox}
      <label htmlFor="fe">{a.email}</label>
      <input ref={firstRef} id="fe" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} {...inv} />
      <button className="btn auth-submit" disabled={busy || !email.trim()} aria-busy={busy || undefined}>{busy ? a.sending : a.send}</button>
      <p className="auth-alt"><Link href="/login" className="link">{a.back}</Link></p>
    </form>}

    {step === 2 && <form className="card auth-card" onSubmit={verify} noValidate>
      {errBox}
      {note && <div className="banner ok" role="status">{note}</div>}
      <label htmlFor="fc">{a.code}</label>
      <input ref={firstRef} id="fc" className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-describedby="fc-note" {...inv} />
      <p className="auth-fine" id="fc-note">{a.codeNote}</p>
      <button className="btn auth-submit" disabled={busy || code.length !== 6} aria-busy={busy || undefined}>{busy ? a.verifying : a.verify}</button>
      <div className="auth-row">
        <button type="button" className="link-btn" onClick={() => sendCode(undefined, true)} disabled={busy || wait > 0}>{wait > 0 ? fill(a.resendIn, { s: wait }) : a.resend}</button>
        <button type="button" className="link-btn" onClick={() => { setStep(1); setErr(""); setNote(""); }}>{a.otherEmail}</button>
      </div>
    </form>}

    {step === 3 && (done ? <div className="card auth-card"><div className="banner ok" role="status">{a.changed}</div></div> :
      <form className="card auth-card" onSubmit={reset} noValidate>
        {errBox}
        <label htmlFor="np">{a.newPw}</label>
        <input ref={firstRef} id="np" type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <label htmlFor="np2">{a.repeatPw}</label>
        <input id="np2" type="password" minLength={8} required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} {...(err === a.mismatch ? inv : {})} />
        <button className="btn auth-submit" disabled={busy || pw.length < 8} aria-busy={busy || undefined}>{busy ? a.saving : a.change}</button>
      </form>)}
  </AuthShell>;
}
