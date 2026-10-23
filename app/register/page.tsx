"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import SocialButtons from "@/components/SocialButtons";
import AuthShell from "@/components/AuthShell";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useI18n } from "@/components/I18nProvider";
import { apiError } from "@/lib/i18n/errors";

// Registration logic unchanged: POST /api/register (new hospitals stay pending until approved), then sign in
// and go to the right portal. ?role=hospital / ?role=ambulance still preselect the account type.
const ROLES: [string, IconName][] = [["PATIENT", "user"], ["HOSPITAL", "hospital"], ["AMBULANCE", "ambulance"]];
// Hospital fields the server requires (app/api/register): marked required so the browser points to them before sending.
const H_REQUIRED = ["name", "address", "phone", "license"];

export default function Register() {
  const { t, lang } = useI18n(); const a = t.auth;
  const [role, setRole] = useState("PATIENT"), [f, setF] = useState<any>({}), [h, setH] = useState<any>({}), [am, setAm] = useState<any>({}), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { const r = new URLSearchParams(window.location.search).get("role"); if (r === "hospital") setRole("HOSPITAL"); if (r === "ambulance") setRole("AMBULANCE"); }, []);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, role, hospital: h, ambulance: am }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); setErr(apiError(t, lang, j.error)); return; }
    await signIn("credentials", { email: f.email, password: f.password, redirect: false });
    window.location.href = role === "HOSPITAL" ? "/portal" : role === "AMBULANCE" ? "/provider" : "/dashboard";
  }
  const hp = role === "HOSPITAL";
  const H = (k: string, label: string, area = false) => <div key={k}><label htmlFor={"h" + k}>{label}</label>{area
    ? <textarea id={"h" + k} rows={3} onChange={(e) => setH({ ...h, [k]: e.target.value })} />
    : <input id={"h" + k} required={H_REQUIRED.includes(k)} onChange={(e) => setH({ ...h, [k]: e.target.value })} autoComplete={k === "phone" ? "tel" : undefined} />}</div>;

  return <AuthShell title={a.regTitle} sub={a.regSub} wide>
    <div className="role-pick" role="radiogroup" aria-label={a.regSub}>
      {ROLES.map(([r, ic]) => <button key={r} type="button" role="radio" aria-checked={role === r} className={"role-card" + (role === r ? " on" : "")} onClick={() => setRole(r)}>
        <span className="role-ic"><Icon name={ic} size={22} /></span><b>{a.roles[r]}</b><small>{a.roleHints[r]}</small></button>)}
    </div>
    <form className="card auth-card" onSubmit={go}>
      {err && <div className="banner warn" role="alert">{err}</div>}
      {role === "PATIENT" && <SocialButtons dividerText={a.orEmailUp} />}
      <label htmlFor="n">{hp || role === "AMBULANCE" ? a.contactName : a.fullName}</label><input id="n" required autoComplete="name" onChange={(e) => setF({ ...f, name: e.target.value })} />
      <label htmlFor="em">{a.email}</label><input id="em" type="email" required autoComplete="email" onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label htmlFor="pw">{a.pwHint}</label><input id="pw" type="password" minLength={8} required autoComplete="new-password" onChange={(e) => setF({ ...f, password: e.target.value })} />
      {hp && <>
        <div className="two">{H("name", a.hName)}{H("location", a.hLocation)}</div>
        {H("address", a.hAddress)}
        <div className="two">{H("phone", a.hPhone)}{H("emergency", a.hEmergency)}</div>
        {H("license", a.hLicense)}{H("description", a.hDesc, true)}
        <div className="banner info"><Icon name="shield" size={16} /> {a.hNote}</div></>}
      {role === "AMBULANCE" && <>
        <label htmlFor="an">{a.aName}</label><input id="an" required onChange={(e) => setAm({ ...am, name: e.target.value })} />
        <div className="two"><div><label htmlFor="aa">{a.aArea}</label><input id="aa" required onChange={(e) => setAm({ ...am, area: e.target.value })} /></div>
          <div><label htmlFor="ap2">{a.aPhone}</label><input id="ap2" required autoComplete="tel" onChange={(e) => setAm({ ...am, phone: e.target.value })} /></div></div>
        <div className="banner info">{a.aNote}</div></>}
      <p className="auth-fine">{a.accept}</p>
      <button className="btn auth-submit" disabled={busy} aria-busy={busy || undefined}>{busy ? a.creating : a.create}</button>
      <p className="auth-alt">{a.haveAccount} <Link href="/login" className="link">{a.signIn}</Link></p>
    </form>
  </AuthShell>;
}
