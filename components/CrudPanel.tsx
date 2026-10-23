"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "./Toast";
import { useI18n } from "./I18nProvider";
import Icon, { type IconName } from "./ui/Icon";
import ConfirmDialog from "./ui/ConfirmDialog";
import { apiError } from "@/lib/i18n/errors";
import { fill, num } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n/dictionaries";

// One form field. Labels and hints come from t.portal.fields[resource][k]; option labels from t.cats (categories) or t.portal.opt.
// `group` starts a titled section (profile form); `wide` spans both columns.
export type F = {
  k: string; type?: "text" | "number" | "bool" | "area" | "select" | "image" | "nbool";
  opts?: string[]; optsFrom?: "cats" | "opt"; showIf?: (f: any) => boolean; group?: string; wide?: boolean;
};
// What a listing card shows: a title, a few short lines and an optional capacity meter.
export type Summary = { title: string; img?: string; lines: [IconName, string][]; meter?: [number, number] };

function resize(file: File, cb: (s: string) => void) {
  const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 240; const s = Math.min(im.width, im.height);
    c.getContext("2d")!.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 240, 240); cb(c.toDataURL("image/jpeg", 0.75)); }; im.src = r.result as string; };
  r.readAsDataURL(file);
}

// Same API as before: GET/POST/PUT/DELETE /api/hospital/<resource>. The server checks ownership and the hospital's status on every call.
export default function CrudPanel({ resource, fields, single, locked, lockedText, summary, onSaved }: {
  resource: string; fields: F[]; single?: boolean; locked?: boolean; lockedText?: string;
  summary?: (row: any, t: Dict, lang: Lang) => Summary; onSaved?: () => void;
}) {
  const { t, lang } = useI18n(); const p = t.portal; const labels = p.fields[resource] || {};
  const [rows, setRows] = useState<any[]>([]), [f, setF] = useState<any>({}), [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false), [del, setDel] = useState<any>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const api = `/api/hospital/${resource}`;
  async function refresh() {
    setFailed(false);
    try { const r = await fetch(api); const j = await r.json(); if (!r.ok) throw new Error(); if (single) setF(j); else setRows(Array.isArray(j) ? j : []); }
    catch { setFailed(true); }
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [resource]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const label = (k: string) => labels[k]?.[0] || k;
  const optLabel = (x: F, o: string) => (x.optsFrom === "cats" ? t.cats[o] : p.opt[o]) || o;

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const body: any = {}; fields.forEach((fl) => { if (fl.showIf && !fl.showIf(f)) return; const v = f[fl.k]; body[fl.k] = fl.type === "number" ? (v === "" || v == null ? undefined : Number(v)) : v; });
    const url = single ? api : f.id ? `${api}?id=${f.id}` : api;
    const r = await fetch(url, { method: single || f.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return toast(apiError(t, lang, j.error), "err");
    toast(p.saved); if (!single) setF({}); refresh(); onSaved?.();
  }
  async function remove(id: string) {
    const r = await fetch(`${api}?id=${id}`, { method: "DELETE" }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(apiError(t, lang, j.error), "err"); return false; }
    toast(p.removed); if (f.id === id) setF({}); refresh();
  }
  function startEdit(row: any) {
    setF(row);
    requestAnimationFrame(() => { formRef.current?.scrollIntoView({ block: "start" }); formRef.current?.querySelector<HTMLElement>("input,select,textarea")?.focus({ preventScroll: true }); });
  }

  const field = (x: F) => {
    const id = resource + "-" + x.k, hint = labels[x.k]?.[1], hid = hint ? id + "-h" : undefined;
    const common = { id, "aria-describedby": hid };
    const input = x.type === "area" ? <textarea {...common} rows={3} value={f[x.k] ?? ""} onChange={(e) => set(x.k, e.target.value)} />
      : x.type === "bool" ? <select {...common} value={String(f[x.k] ?? true)} onChange={(e) => set(x.k, e.target.value === "true")}><option value="true">{p.yes}</option><option value="false">{p.no}</option></select>
      : x.type === "nbool" ? <select {...common} value={f[x.k] == null ? "" : String(f[x.k])} onChange={(e) => set(x.k, e.target.value === "" ? null : e.target.value === "true")}><option value="">{p.notSpecified}</option><option value="true">{p.ac}</option><option value="false">{p.nonAc}</option></select>
      : x.type === "select" ? <select {...common} value={f[x.k] ?? ""} onChange={(e) => set(x.k, e.target.value)}><option value="">{p.select}</option>{x.opts!.map((o) => <option key={o} value={o}>{optLabel(x, o)}</option>)}</select>
      : x.type === "image" ? <div className="photo-field">
          <span className="photo-prev">{f[x.k] ? <img src={f[x.k]} alt="" width={64} height={64} /> : <Icon name={resource === "profile" ? "hospital" : "user"} size={26} />}</span>
          <input {...common} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && resize(e.target.files[0], (s) => set(x.k, s))} /></div>
      : <input {...common} type={x.type === "number" ? "number" : "text"} inputMode={x.type === "number" ? "numeric" : undefined} min={x.type === "number" ? 0 : undefined} value={f[x.k] ?? ""} onChange={(e) => set(x.k, e.target.value)} />;
    return <div key={x.k} className={"fld" + (x.wide || x.type === "area" || x.type === "image" ? " wide" : "")}>
      <label htmlFor={id}>{label(x.k)}</label>{input}
      {(hint || x.type === "image") && <p className="hint" id={hid}>{hint || p.photoHint}</p>}
    </div>;
  };

  // Fields rendered in order; a field with `group` opens a new titled section.
  const visible = fields.filter((x) => !x.showIf || x.showIf(f));
  const sections: { title?: string; items: F[] }[] = [];
  visible.forEach((x) => { if (x.group || !sections.length) sections.push({ title: x.group ? p.groups[x.group] : undefined, items: [] }); sections[sections.length - 1].items.push(x); });

  const form = (
    <form ref={formRef} className={"card crud-form" + (f.id ? " editing" : "")} onSubmit={save} aria-labelledby={single ? undefined : resource + "-ft"}>
      {!single && <div className="crud-form-head"><span className="crud-form-ic"><Icon name={f.id ? "check" : "sparkle"} size={18} /></span><h3 id={resource + "-ft"}>{f.id ? p.editItem : p.newItem}</h3></div>}
      {sections.map((s, i) => <fieldset key={i} className="fld-group">
        {s.title && <legend>{s.title}</legend>}
        <div className="fld-grid">{s.items.map(field)}</div>
      </fieldset>)}
      {locked && !single && lockedText && <p className="banner warn lock-note"><Icon name="alert" size={16} /> {lockedText}</p>}
      <div className="form-actions">
        <button className="btn" disabled={locked || busy} aria-busy={busy || undefined}>{single || f.id ? p.update : p.publish}</button>
        {f.id && <button type="button" className="btn ghost" onClick={() => setF({})}>{p.cancelEdit}</button>}
      </div>
    </form>);

  const retry = <div className="empty error" role="alert"><span className="empty-ic"><Icon name="alert" size={28} /></span><h3>{p.loadFailed}</h3>
    <p className="empty-act"><button type="button" className="btn sm" onClick={() => { setLoading(true); refresh(); }}>{p.retry}</button></p></div>;

  if (single) return loading ? <div className="skel tall" /> : failed ? retry : form;
  return <div className="crud">
    <section className="crud-list" aria-labelledby={resource + "-lt"}>
      <h3 id={resource + "-lt"} className="crud-list-title">{fill(p.listTitle, { n: num(lang, rows.length) })}</h3>
      {loading ? <div className="skel" /> : failed ? retry : rows.length ? <ul className="list-cards">{rows.map((r) => {
        const s: Summary = summary ? summary(r, t, lang) : { title: r.name || r.category, lines: [] };
        return <li key={r.id} className={"card list-card" + (f.id === r.id ? " is-editing" : "")}>
          <div className="lc-top">
            {s.img !== undefined && <span className="lc-av">{s.img ? <img src={s.img} alt="" width={48} height={48} /> : (s.title || "?").slice(0, 1)}</span>}
            <div className="lc-main"><h4>{s.title}</h4>
              {s.lines.map(([ic, tx], i) => <p key={i} className="meta"><Icon name={ic} size={15} />{tx}</p>)}</div>
            {r.published === false ? <span className="badge warn">{p.unpublished}</span> : <span className="badge ok"><Icon name="check" size={14} />{p.live}</span>}
          </div>
          {s.meter && s.meter[1] > 0 && <div className="meter" aria-hidden><span style={{ width: `${Math.min(100, (s.meter[0] / s.meter[1]) * 100)}%` }} /></div>}
          <div className="lc-foot">
            <button type="button" className="btn ghost sm" onClick={() => startEdit(r)}>{p.edit}</button>
            <button type="button" className="btn del sm" disabled={locked} onClick={() => setDel(r)}>{p.remove}</button>
          </div>
        </li>; })}</ul>
        : <div className="empty"><span className="empty-ic"><Icon name="inbox" size={28} /></span><h3>{p.emptyListT}</h3><p>{p.emptyList}</p></div>}
    </section>
    <div className="crud-side">{form}</div>
    {del && <ConfirmDialog title={p.removeTitle} text={(summary ? summary(del, t, lang).title : del.name) + " · " + p.removeText} confirmLabel={p.yesRemove}
      cancelLabel={p.keepItem} closeLabel={t.book.close} danger onConfirm={() => remove(del.id)} onClose={() => setDel(null)} />}
  </div>;
}
