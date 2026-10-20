"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "@/components/Toast";
import SocialButtons from "@/components/SocialButtons";
export default function Register() {
  const [role, setRole] = useState("PATIENT"), [f, setF] = useState<any>({}), [h, setH] = useState<any>({}), [am, setAm] = useState<any>({}), [busy, setBusy] = useState(false);
  useEffect(() => { const r = new URLSearchParams(window.location.search).get("role"); if (r === "hospital") setRole("HOSPITAL"); if (r === "ambulance") setRole("AMBULANCE"); }, []);
  async function go(e: any) {
    e.preventDefault(); setBusy(true);
    const r = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, role, hospital: h, ambulance: am }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); return toast(j.error || "Registration failed", "err"); }
    await signIn("credentials", { email: f.email, password: f.password, redirect: false });
    window.location.href = role === "HOSPITAL" ? "/portal" : role === "AMBULANCE" ? "/provider" : "/dashboard";
  }
  const hp = role === "HOSPITAL", H = (k: string, label: string, area = false) => <div><label htmlFor={"h" + k}>{label}</label>{area ? <textarea id={"h" + k} rows={2} onChange={(e) => setH({ ...h, [k]: e.target.value })} /> : <input id={"h" + k} onChange={(e) => setH({ ...h, [k]: e.target.value })} />}</div>;
  return <div style={{ maxWidth: 520 }}><h1>Create account</h1>
    <div className="tabs"><button className={"tab " + (!hp ? "on" : "")} onClick={() => setRole("PATIENT")}>Patient</button><button className={"tab " + (hp ? "on" : "")} onClick={() => setRole("HOSPITAL")}>Hospital / Clinic</button><button className={"tab " + (role === "AMBULANCE" ? "on" : "")} onClick={() => setRole("AMBULANCE")}>Ambulance provider</button></div>
    <form className="card" onSubmit={go}>
      {role === "PATIENT" && <><SocialButtons /><p className="sub" style={{ textAlign: "center", margin: "6px 0" }}>or sign up with email</p></>}
      <label htmlFor="n">{hp || role === "AMBULANCE" ? "Contact person name" : "Full name"}</label><input id="n" required onChange={(e) => setF({ ...f, name: e.target.value })} />
      <label htmlFor="em">Email</label><input id="em" type="email" required autoComplete="email" onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label htmlFor="pw">Password (8+ characters)</label><input id="pw" type="password" minLength={8} required autoComplete="new-password" onChange={(e) => setF({ ...f, password: e.target.value })} />
      {hp && <>{H("name", "Hospital / clinic name")}{H("address", "Address")}{H("location", "City / area")}{H("phone", "Official phone")}{H("emergency", "Emergency contact")}{H("license", "Licence / registration number")}{H("description", "Description", true)}
        <div className="banner info" style={{ marginTop: 12 }}>After registering you pay a one-time BDT 100 fee (includes the first 30 days), then BDT 50 per month. Your listing goes live once payment is verified.</div></>}
      {role === "AMBULANCE" && <><label htmlFor="an">Service / company name</label><input id="an" required onChange={(e) => setAm({ ...am, name: e.target.value })} /><label htmlFor="aa">Area / city</label><input id="aa" required onChange={(e) => setAm({ ...am, area: e.target.value })} /><label htmlFor="ap2">Service phone</label><input id="ap2" required onChange={(e) => setAm({ ...am, phone: e.target.value })} /><div className="banner info" style={{ marginTop: 12 }}>Registration is free. The patient pays the BDT 10 fee only when a booking is confirmed.</div></>}
      <p style={{ fontSize: 12, color: "var(--mut)", marginTop: 10 }}>By creating an account you accept the Terms and Privacy Policy.</p>
      <button className="btn" style={{ width: "100%", marginTop: 8 }} disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form></div>;
}
