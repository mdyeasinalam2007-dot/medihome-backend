"use client";
import { useEffect, useState } from "react";
import { toast } from "./Toast";

export type F = { k: string; label: string; type?: "text" | "number" | "bool" | "area" | "select" | "image" | "nbool"; opts?: [string, string][]; showIf?: (f: any) => boolean; hint?: string };

function resize(file: File, cb: (s: string) => void) {
  const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 240; const s = Math.min(im.width, im.height);
    c.getContext("2d")!.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 240, 240); cb(c.toDataURL("image/jpeg", 0.75)); }; im.src = r.result as string; };
  r.readAsDataURL(file);
}

export default function CrudPanel({ resource, fields, single, locked, show }: { resource: string; fields: F[]; single?: boolean; locked?: boolean; show?: string[] }) {
  const [rows, setRows] = useState<any[]>([]), [f, setF] = useState<any>({}), [loading, setLoading] = useState(true);
  const api = `/api/hospital/${resource}`;
  async function refresh() { const r = await fetch(api); const j = await r.json(); if (single) setF(j); else setRows(Array.isArray(j) ? j : []); setLoading(false); }
  useEffect(() => { refresh(); }, [resource]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  async function save(e: any) {
    e.preventDefault();
    const body: any = {}; fields.forEach((fl) => { if (fl.showIf && !fl.showIf(f)) return; const v = f[fl.k]; body[fl.k] = fl.type === "number" ? (v === "" || v == null ? undefined : Number(v)) : v; });
    const url = single ? api : f.id ? `${api}?id=${f.id}` : api;
    const r = await fetch(url, { method: single || f.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error || "Failed", "err");
    toast("Saved"); if (!single) setF({}); refresh();
  }
  async function del(id: string) { if (!confirm("Remove this item?")) return; const r = await fetch(`${api}?id=${id}`, { method: "DELETE" }); const j = await r.json().catch(() => ({})); r.ok ? refresh() : toast(j.error || "Failed", "err"); }

  const form = (
    <form className="card" onSubmit={save} style={{ maxWidth: 560 }}>
      {!single && <h3>{f.id ? "Edit item" : "Add new"}</h3>}
      {fields.filter((x) => !x.showIf || x.showIf(f)).map((x) => (
        <div key={x.k}><label htmlFor={resource + x.k}>{x.label}</label>
          {x.type === "area" ? <textarea id={resource + x.k} rows={2} value={f[x.k] ?? ""} onChange={(e) => set(x.k, e.target.value)} />
          : x.type === "bool" ? <select id={resource + x.k} value={String(f[x.k] ?? true)} onChange={(e) => set(x.k, e.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select>
          : x.type === "nbool" ? <select id={resource + x.k} value={f[x.k] == null ? "" : String(f[x.k])} onChange={(e) => set(x.k, e.target.value === "" ? null : e.target.value === "true")}><option value="">Not specified</option><option value="true">AC</option><option value="false">Non-AC</option></select>
          : x.type === "select" ? <select id={resource + x.k} value={f[x.k] ?? ""} onChange={(e) => set(x.k, e.target.value)}><option value="">Select…</option>{x.opts!.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
          : x.type === "image" ? <><input id={resource + x.k} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && resize(e.target.files[0], (s) => set(x.k, s))} />{f[x.k] && <img src={f[x.k]} alt="" width={56} height={56} style={{ borderRadius: 8, marginTop: 6 }} />}</>
          : <input id={resource + x.k} type={x.type === "number" ? "number" : "text"} min={x.type === "number" ? 0 : undefined} value={f[x.k] ?? ""} onChange={(e) => set(x.k, e.target.value)} />}
          {x.hint && <p style={{ fontSize: 11, color: "var(--mut)" }}>{x.hint}</p>}</div>))}
      <div className="row"><button className="btn" disabled={locked}>{single ? "Save changes" : f.id ? "Update" : "Publish"}</button>{f.id && <button type="button" className="btn ghost" onClick={() => setF({})}>Cancel edit</button>}</div>
      {locked && !single && <p style={{ color: "var(--amb)", fontSize: 12, marginTop: 8 }}>Renew your subscription to add or change listings.</p>}
    </form>);

  if (single) return loading ? <div className="skel" /> : form;
  return <div>{form}<h2 style={{ margin: "20px 0 8px" }}>Published ({rows.length})</h2>
    {loading ? <div className="skel" /> : <div className="grid">{rows.length ? rows.map((r) => (
      <div className="card" key={r.id}><h3>{r.name || r.category || "Item"}</h3>
        {(show || []).map((k) => r[k] !== "" && r[k] != null && <p key={k}>{k}: {String(r[k])}</p>)}
        <div className="row">{r.published === false ? <span className="badge warn">Unpublished</span> : <span className="badge ok">Live</span>}
          <span><button className="btn ghost sm" onClick={() => { setF(r); window.scrollTo(0, 0); }}>Edit</button> <button className="btn del" disabled={locked} onClick={() => del(r.id)}>Remove</button></span></div></div>))
      : <div className="empty"><h3>Nothing published yet</h3><p>Use the form above to add your first item.</p></div>}</div>}</div>;
}
