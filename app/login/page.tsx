"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "@/components/Toast";
import SocialButtons from "@/components/SocialButtons";
export default function Login() {
  const [f, setF] = useState({ email: "", password: "" }), [busy, setBusy] = useState(false), [note, setNote] = useState("");
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e === "OAuthAccountNotLinked") setNote("This email already has an account created another way. Sign in with the original method (email/password, Google or Facebook).");
    else if (e) setNote("Sign-in failed. Please try again or use another method.");
  }, []);
  async function go(e: any) {
    e.preventDefault(); setBusy(true);
    const r = await signIn("credentials", { ...f, redirect: false }); setBusy(false);
    if (r?.error) toast("Wrong email or password", "err"); else window.location.href = "/dashboard";
  }
  return <div style={{ maxWidth: 420 }}><h1>Sign in</h1>
    <div className="card" style={{ marginTop: 14 }}>
      {note && <div className="banner warn">{note}</div>}
      <SocialButtons dividerText="or sign in with email" />
      <form onSubmit={go}>
        <label htmlFor="e">Email</label><input id="e" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <label htmlFor="p">Password</label><input id="p" type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <p style={{ textAlign: "right", fontSize: 13, margin: "6px 0 0" }}><Link href="/forgot-password" style={{ color: "var(--blue)", fontWeight: 600 }}>Forgot password?</Link></p>
        <button className="btn" style={{ width: "100%", marginTop: 10 }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form>
      <p style={{ marginTop: 12, fontSize: 13 }}>New here? <Link href="/register" style={{ color: "var(--blue)", fontWeight: 700 }}>Create an account</Link></p>
    </div></div>;
}
