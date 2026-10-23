"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import SocialButtons from "@/components/SocialButtons";
import AuthShell from "@/components/AuthShell";
import { useI18n } from "@/components/I18nProvider";
import { setRememberChoice } from "@/lib/remember";
import { safeNext } from "@/lib/safeNext";

// Sign-in: NextAuth credentials, then back to ?next= (same-site only) or /dashboard (which routes each role to its portal).
export default function Login() {
  const { t } = useI18n(); const a = t.auth;
  const [f, setF] = useState({ email: "", password: "" }), [busy, setBusy] = useState(false), [note, setNote] = useState(""), [err, setErr] = useState(""), [remember, setRemember] = useState(false);
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    // NextAuth error codes: never shown raw; each maps to a translated, plain-language note
    if (e === "OAuthAccountNotLinked") setNote(a.oauthLinked);
    else if (e === "AccessDenied") setNote(a.oauthDenied);
    else if (e === "OAuthCallback" || e === "Callback") setNote(a.oauthCancelled);
    else if (e) setNote(a.oauthFailed);
  }, [a.oauthLinked, a.oauthFailed, a.oauthDenied, a.oauthCancelled]);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    setRememberChoice(remember); // this device only
    const r = await signIn("credentials", { ...f, redirect: false }); setBusy(false);
    // back to the page that asked for sign-in (same-site paths only), otherwise /dashboard
    if (r?.error) setErr(a.wrong); else window.location.href = safeNext(new URLSearchParams(window.location.search).get("next"));
  }
  const inv = err ? { "aria-invalid": true as const, "aria-describedby": "login-err" } : {};
  return <AuthShell title={a.signInTitle} sub={a.signInSub}>
    <div className="card auth-card">
      {note && <div className="banner warn" role="alert">{note}</div>}
      {err && <div className="banner warn" role="alert" id="login-err">{err}</div>}
      <SocialButtons dividerText={a.orEmail} remember={remember} />
      <form onSubmit={go}>
        <label htmlFor="e">{a.email}</label><input id="e" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} {...inv} />
        <label htmlFor="p">{a.password}</label><input id="p" type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} {...inv} />
        <div className="auth-row">
          <label className="check" htmlFor="rm"><input id="rm" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} aria-describedby="rm-hint" /><span>{a.remember}</span></label>
          <Link href="/forgot-password" className="link auth-forgot">{a.forgot}</Link>
        </div>
        <p className="auth-fine" id="rm-hint">{a.rememberHint}</p>
        <button className="btn auth-submit" disabled={busy} aria-busy={busy || undefined}>{busy ? a.signingIn : a.signIn}</button>
      </form>
      <p className="auth-alt">{a.newHere} <Link href="/register" className="link">{a.create}</Link></p>
    </div>
  </AuthShell>;
}
