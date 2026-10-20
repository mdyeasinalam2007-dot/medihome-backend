"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "./Toast";
export default function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [f, setF] = useState({ name, phone });
  async function save() { const r = await fetch("/api/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }); const j = await r.json(); r.ok ? toast("Profile saved") : toast(j.error, "err"); }
  async function del() { if (!confirm("Delete your account? Your personal data will be erased. This cannot be undone.")) return; const r = await fetch("/api/me", { method: "DELETE" }); if (r.ok) signOut({ callbackUrl: "/" }); else toast("Could not delete", "err"); }
  return <div className="card" style={{ maxWidth: 440 }}><h3>My profile</h3>
    <label htmlFor="pn">Name</label><input id="pn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
    <label htmlFor="pp">Phone (kept private)</label><input id="pp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
    <div className="row"><button className="btn" onClick={save}>Save</button><button className="btn del" onClick={del}>Delete account</button></div></div>;
}
