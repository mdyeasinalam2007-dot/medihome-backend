"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "./Toast";
import Icon, { type IconName } from "./ui/Icon";
import RatchetOrb from "./ui/RatchetOrb";
import Modal from "./ui/Modal";
import Words from "./ui/Words";
import { useI18n } from "./I18nProvider";
import { apiError } from "@/lib/i18n/errors";
import { fill, localToday, money, num } from "@/lib/format";
import { mdSegments, plainText, type Seg } from "@/lib/mdlite";

// Ratchet, the AI assistant. Same APIs and rules as before (/api/ai, /api/ai/book/prepare, /api/ai/book):
// answers come back whole (the server does not stream), so new answers are revealed word by word on screen
// only for readability; nothing is booked without the patient's explicit Confirm.
const LANGS: [string, string][] = [["auto", "en-US"], ["Bangla", "bn-BD"], ["English", "en-US"], ["Arabic", "ar-SA"], ["Hindi", "hi-IN"], ["Urdu", "ur-PK"]];
const STOP = /^(stop|stop speaking|be quiet|থামো|থামুন|চুপ|বন্ধ করো)[.!।\s]*$/i, REPEAT = /^(repeat( that)?|say that again|আবার বলো|আবার বলুন|রিপিট)[.!।\s]*$/i;
const plain = (t: string) => t.replace(/```[\s\S]*?```/g, " ").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/https?:\S+/g, "").replace(/\[(R|W)\d+\]/g, "").replace(/[*_#>`]/g, "");
const chunks = (t: string) => { const out: string[] = []; let cur = ""; for (const s of plain(t).split(/(?<=[.!?।\n])\s+/)) { if ((cur + " " + s).length > 180 && cur) { out.push(cur); cur = s; } else cur = (cur + " " + s).trim(); } if (cur) out.push(cur); return out; };
const guess = (t: string, sel: string) => /[ঀ-৿]/.test(t) ? "bn-BD" : /[ऀ-ॿ]/.test(t) ? "hi-IN" : /[؀-ۿ]/.test(t) ? (sel === "Urdu" ? "ur-PK" : "ar-SA") : "en-US";
const PROMPT_IC: IconName[] = ["doctor", "test", "heartPulse"];
let seq = 0;

type Doc = any;
type Msg = { id: number; role: "user" | "assistant"; text: string; fresh?: boolean; error?: boolean; emergency?: boolean; doctors?: Doc[]; sources?: any[]; webNote?: string; fromFile?: boolean; bookingId?: string };

// Reveals a new answer word by word (about 0.35 to 1.6 s, never slower). Screen readers get the whole answer at once;
// with reduced motion it appears immediately. Older answers are always shown in full.
// **bold** and list bullets are shown formatted (see lib/mdlite.ts); everything is rendered as escaped text.
function Formatted({ segs, upTo }: { segs: Seg[]; upTo: number }) {
  let left = upTo;
  return <>{segs.map((x, i) => { if (left <= 0) return null; const part = x.s.slice(0, left); left -= x.s.length; return x.b ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>; })}</>;
}
function Typed({ text: raw, animate, onTick, onDone }: { text: string; animate: boolean; onTick: () => void; onDone: () => void }) {
  const segs = useMemo(() => mdSegments(raw), [raw]), text = useMemo(() => plainText(segs), [segs]);
  const [n, setN] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setN(text.length); onDone(); return; }
    const total = Math.min(1600, Math.max(350, text.length * 7)), t0 = performance.now(); let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / total); let k = Math.round(text.length * p);
      if (p < 1) { const sp = text.indexOf(" ", k); k = sp === -1 ? text.length : sp; }
      setN(k); onTick();
      if (p < 1) raf = requestAnimationFrame(step); else onDone();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- runs once per new answer
  if (n >= text.length) return <div className="rt-text"><Formatted segs={segs} upTo={text.length} /></div>;
  return <div className="rt-text"><span aria-hidden><Formatted segs={segs} upTo={n} /><span className="rt-caret" /></span><span className="sr-only">{text}</span></div>;
}

export default function Consultant() {
  const { data, status: auth } = useSession();
  const { t, lang } = useI18n(); const a = t.ai;
  const [msgs, setMsgs] = useState<Msg[]>([]), [input, setInput] = useState(""), [aiLang, setAiLang] = useState("auto"), [file, setFile] = useState<any>(null), [web, setWeb] = useState(false);
  const [busy, setBusy] = useState(false), [st, setSt] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [convo, setConvo] = useState(false), [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]), [voiceURI, setVoiceURI] = useState(""), [paused, setPaused] = useState(false);
  const [review, setReview] = useState<any>(null), [side, setSide] = useState(false), [copied, setCopied] = useState<number | null>(null);
  const convoRef = useRef(false), recRef = useRef<any>(null), msgsRef = useRef<Msg[]>([]), lastReply = useRef(""), sel = useRef("auto");
  const scrollRef = useRef<HTMLDivElement>(null), taRef = useRef<HTMLTextAreaElement>(null), sideRef = useRef<HTMLElement>(null), menuRef = useRef<HTMLButtonElement>(null);
  convoRef.current = convo; msgsRef.current = msgs; sel.current = aiLang;
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const sttCode = () => LANGS.find((l) => l[0] === aiLang)![1];

  useEffect(() => { if (!synth) return; const load = () => setVoices(synth.getVoices()); load(); synth.addEventListener?.("voiceschanged", load); return () => { synth.cancel(); recRef.current?.abort?.(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toBottom = (force = false) => { const el = scrollRef.current; if (!el) return; if (force || el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight; };
  useEffect(() => { toBottom(true); }, [msgs.length, st]);
  // mobile settings panel: Esc closes it and focus returns to the menu button
  useEffect(() => {
    if (!side) return;
    sideRef.current?.querySelector<HTMLElement>("button,select,input")?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setSide(false); menuRef.current?.focus(); } };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, [side]);
  const grow = () => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 192) + "px"; };
  useEffect(grow, [input]);

  /* ---------- speaking ---------- */
  function stopSpeak() { synth?.cancel(); setPaused(false); setSt((s) => (s === "speaking" ? "idle" : s)); }
  function speak(text: string) {
    if (!synth) return toast(a.cannotSpeak, "err");
    stopSpeak(); const code = guess(text, sel.current), prefix = code.slice(0, 2);
    const pool = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix)), v = pool.find((x) => x.voiceURI === voiceURI) || pool[0];
    if (!v) { toast(a.noVoice, "err"); if (convoRef.current) setTimeout(listen, 400); return; }
    const parts = chunks(text); if (!parts.length) return;
    parts.forEach((c, i) => { const u = new SpeechSynthesisUtterance(c); u.voice = v; u.lang = v.lang;
      if (i === parts.length - 1) { u.onend = () => { setSt("idle"); if (convoRef.current) setTimeout(listen, 300); }; u.onerror = () => setSt("idle"); }
      synth.speak(u); });
    setSt("speaking");
  }

  /* ---------- listening (browser speech recognition; in Chrome/Edge the audio is processed by the browser vendor's service) ---------- */
  function listen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast(a.needChrome, "err");
    if (busy) return; stopSpeak(); recRef.current?.abort?.();
    const r = new SR(); r.lang = sttCode(); r.interimResults = true; r.continuous = false; let finalText = "";
    r.onstart = () => setSt("listening");
    r.onresult = (e: any) => { let tx = ""; for (let i = 0; i < e.results.length; i++) tx += e.results[i][0].transcript; finalText = tx; setInput(tx); };
    r.onerror = (e: any) => { setSt("idle"); setConvo(false); const m: Record<string, string> = { "not-allowed": a.micDenied, "service-not-allowed": a.micDenied, "no-speech": a.noSpeech, "audio-capture": a.noMic, network: a.speechNet, "language-not-supported": a.langUnsupported }; if (e.error !== "aborted") toast(m[e.error] || a.voiceFailed, "err"); };
    r.onend = () => { if (finalText.trim()) { setInput(""); voiceText(finalText.trim()); } else setSt((s) => (s === "listening" ? "idle" : s)); };
    try { r.start(); recRef.current = r; } catch { setSt("idle"); }
  }
  function voiceText(tx: string) {
    if (STOP.test(tx)) { stopSpeak(); setConvo(false); return; }
    if (REPEAT.test(tx)) { if (lastReply.current) speak(lastReply.current); else toast(a.nothingRepeat); return; }
    send(tx, true);
  }
  const micClick = () => { if (st === "listening") { recRef.current?.stop?.(); } else { setConvo(false); listen(); } };
  const toggleConvo = () => { if (convo) { setConvo(false); recRef.current?.abort?.(); stopSpeak(); setSt("idle"); } else { setConvo(true); setTimeout(listen, 50); } };

  /* ---------- sending ---------- */
  async function send(text?: string, spoken = false) {
    const tx = (text ?? input).trim(); if ((!tx && !file) || busy) return;
    const next: Msg[] = [...msgsRef.current, { id: ++seq, role: "user", text: tx || a.explainFile }]; setMsgs(next); setInput(""); setBusy(true); setSt("thinking"); stopSpeak();
    try {
      const r = await fetch("/api/ai", { method: "POST", signal: AbortSignal.timeout(60_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, text: m.text })), lang: aiLang, uiLang: lang, webSearch: web, file: file ? { mime: file.mime, base64: file.base64 } : undefined }) });
      const j = await r.json().catch(() => ({})); setFile(null);
      const reply = r.ok ? j.reply : limitText(j) || apiError(t, lang, j.error, a.generic);
      setMsgs([...next, { id: ++seq, role: "assistant", text: reply, fresh: true, ...(r.ok ? { doctors: j.doctors, sources: j.sources, emergency: j.emergency, webNote: j.webNote, fromFile: j.file } : { error: true }) }]);
      lastReply.current = reply; setSt("idle");
      if (spoken || convoRef.current) speak(reply);
    } catch (e: any) { // no answer within 60 s = busy; anything else = connection problem
      setMsgs([...next, { id: ++seq, role: "assistant", text: e?.name === "TimeoutError" ? t.errs.aiBusy : a.network, error: true }]); setSt("idle"); if (convoRef.current) setConvo(false); }
    setBusy(false);
  }
  function pick(f?: File) { if (!f) return setFile(null); if (f.size > 5_000_000) return toast(a.tooLarge, "err"); const r = new FileReader(); r.onload = () => setFile({ name: f.name, mime: f.type, base64: String(r.result).split(",")[1] }); r.readAsDataURL(f); }
  // 429 answers carry a code: our own per-user limits vs Google's quota for the API key, each with its own text.
  const limitText = (j: any): string | null => {
    if (j?.code === "AI_QUOTA_DAY") return fill(t.errs.aiQuotaDay, { h: num(lang, Math.max(1, Math.round((Number(j.retryAfter) || 3600) / 3600))) });
    if (j?.code === "AI_QUOTA_MINUTE") return t.errs.aiQuotaMinute;
    if (j?.code === "USER_RATE_MINUTE") return t.errs.userRateMinute;
    if (j?.code === "USER_RATE_DAY") return t.errs.userRateDay;
    return null;
  };
  const done = (id: number) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, fresh: false } : x)));
  const newChat = () => { setMsgs([]); stopSpeak(); setConvo(false); setSide(false); setTimeout(() => taRef.current?.focus(), 0); };
  async function copy(m: Msg) { try { await navigator.clipboard.writeText(m.text); setCopied(m.id); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked: nothing to do */ } }

  /* ---------- booking: review -> explicit confirm -> existing booking system ---------- */
  async function prepare(d: Doc, date: string, time: string) {
    const r = await fetch("/api/ai/book/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doctorId: d.id, date, time }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(r.status === 403 ? a.patientOnly : apiError(t, lang, j.error, a.prepFailed), "err"); setReview(j); stopSpeak();
  }
  async function confirmBook() {
    const tk = review.token; setReview(null);
    const r = await fetch("/api/ai/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tk }) }); const j = await r.json().catch(() => ({}));
    const text = r.ok ? fill(j.status === "CONFIRMED" ? a.booked : a.requested, { id: String(j.bookingId).slice(-8).toUpperCase() }) : apiError(t, lang, j.error, a.generic);
    setMsgs((m) => [...m, { id: ++seq, role: "assistant", text, fresh: true, bookingId: r.ok ? j.bookingId : undefined, error: !r.ok }]); lastReply.current = text;
    if (convoRef.current) speak(text);
  }

  if (auth === "loading") return <div className="rt-app solo"><section className="rt-main"><div className="rt-gate"><RatchetOrb size="lg" busy /><span className="sr-only">{a.thinking}</span></div></section></div>;
  if (!data?.user) return <div className="rt-app solo"><section className="rt-main" aria-labelledby="rt-gate-h">
    <div className="rt-gate"><RatchetOrb size="lg" /><p className="eyebrow light">{a.name} · {a.tagline}</p>
      <h1 id="rt-gate-h" className="rt-welcome-h"><Words text={a.signInTitle} /></h1><p>{a.signInText}</p>
      <div className="hero-cta"><Link className="btn lg glow" href="/login">{a.signIn}<Icon name="arrow" size={18} /></Link><Link className="btn lg glass" href="/register">{a.register}</Link></div></div>
  </section></div>;

  const stLabel = { idle: "", listening: a.listening, thinking: "", speaking: a.speaking }[st];
  const user = data.user as any, initial = String(user.name || user.email || "?").trim().charAt(0).toUpperCase();
  const langLabel = (k: string) => (k === "auto" ? a.autoTyped : a.langs[k] || k);

  return <div className="rt-app">
    <aside ref={sideRef} id="rt-side" className={"rt-side" + (side ? " open" : "")} aria-label={a.settings}>
      <div className="rt-brand"><RatchetOrb size="sm" /><span><b>{a.name}</b><small>{a.tagline}</small></span>
        <button type="button" className="icon-btn sm rt-side-close" onClick={() => { setSide(false); menuRef.current?.focus(); }} aria-label={a.close}><Icon name="close" size={18} /></button></div>
      <button type="button" className="rt-new" onClick={newChat}><Icon name="sparkle" size={18} />{a.newChat}</button>
      <div className="rt-group"><p className="rt-gh"><Icon name="globe" size={14} />{a.settings}</p>
        <label htmlFor="rt-lang">{a.language}</label>
        <select id="rt-lang" value={aiLang} onChange={(e) => setAiLang(e.target.value)}>{LANGS.map(([k]) => <option key={k} value={k}>{langLabel(k)}</option>)}</select>
        <label htmlFor="rt-voice">{a.voice}</label>
        <select id="rt-voice" value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}><option value="">{a.automatic}</option>{voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select>
        <label className="rt-switch"><input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} /><span>{a.web}<small>{a.webHint}</small></span></label>
      </div>
      <div className="rt-group"><p className="rt-gh"><Icon name="mic" size={14} />{a.voiceTools}</p>
        <div className="rt-voice">
          <button type="button" className={"btn sm " + (convo ? "bk" : "ghost")} onClick={toggleConvo} aria-pressed={convo}><Icon name="speaker" size={16} />{convo ? a.endVoice : a.voiceChat}</button>
        </div>
        <p className="rt-fine">{a.voiceHelp}</p>
      </div>
      <div className="rt-safety"><b><Icon name="alert" size={16} />{a.safetyTitle}</b><p>{a.safetyText}</p><a className="btn sos sm" href="tel:999"><Icon name="phone" size={16} />{a.call}</a></div>
      <div className="rt-user"><span className="who-av" aria-hidden>{initial}</span><span><b>{user.name || a.you}</b>{user.email && <small>{user.email}</small>}</span></div>
    </aside>
    {side && <button type="button" className="rt-scrim" aria-label={a.close} tabIndex={-1} onClick={() => setSide(false)} />}

    <section className="rt-main" aria-label={a.name}>
      <div className="rt-top">
        <button ref={menuRef} type="button" className="icon-btn rt-menu" onClick={() => setSide(true)} aria-controls="rt-side" aria-expanded={side} aria-label={a.settings}><Icon name="menu" size={18} /></button>
        <span className="rt-model"><RatchetOrb size="xs" busy={busy} />{a.name} <small>· {aiLang === "auto" ? a.automatic : langLabel(aiLang)}</small></span>
        <span className="sp" />
        {msgs.length > 0 && <button type="button" className="icon-btn" onClick={newChat} aria-label={a.newChat} title={a.newChat}><Icon name="sparkle" size={18} /></button>}
      </div>

      <div className="rt-scroll" ref={scrollRef}>
        <div className="rt-col" aria-live="polite">
          {!msgs.length && <div className="rt-welcome">
            <RatchetOrb size="lg" />
            <h1><Words text={a.welcome} /></h1>
            <p className="rise d4">{a.welcomeSub}</p>
            <div className="rt-prompts">{a.prompts.map((p, i) => <button key={p.q} type="button" className="rt-prompt" style={{ "--i": i } as React.CSSProperties} onClick={() => send(p.q)} disabled={busy}>
              <b><Icon name={PROMPT_IC[i] || "sparkle"} size={16} />{p.t}</b><span>“{p.s}”</span></button>)}</div>
          </div>}

          {msgs.map((m) => m.role === "user"
            ? <div key={m.id} className="rt-msg user"><div className="rt-bubble"><span className="sr-only">{a.you}: </span><div className="rt-text">{m.text}</div></div></div>
            : <div key={m.id} className={"rt-msg assistant" + (m.emergency ? " emergency" : "") + (m.error ? " error" : "")}>
              <RatchetOrb size="xs" />
              <div className="rt-bubble"><span className="sr-only">{a.name}: </span>
                <Typed text={m.text} animate={!!m.fresh} onTick={() => toBottom()} onDone={() => done(m.id)} />
                {!m.fresh && <>
                  {m.webNote && <div className="disc">{m.webNote}</div>}
                  {m.fromFile && <div className="disc">{a.clinician} <Link href="/doctors">{a.findDoctor}</Link></div>}
                  {(m.sources?.length || 0) > 0 && <div className="disc">{a.sources}: {m.sources!.map((s: any) => <span key={s.id}><a href={s.url} target="_blank" rel="noreferrer">[{s.id}] {s.title}</a> ({fill(a.retrieved, { d: String(s.retrievedAt).slice(0, 10) })}) </span>)}</div>}
                  {m.bookingId && <div className="rt-acts"><Link className="btn ghost sm" href={`/bookings/${m.bookingId}`}>{a.viewBooking}<Icon name="arrow" size={16} /></Link></div>}
                  {m.doctors?.map((d: Doc) => <DoctorCard key={d.id} d={d} onReview={prepare} />)}
                  {!m.error && <div className="rt-acts">
                    <button type="button" className="rt-act" onClick={() => speak(m.text)}><Icon name="speaker" size={15} />{a.play}</button>
                    <button type="button" className="rt-act" onClick={() => copy(m)}><Icon name="check" size={15} />{copied === m.id ? a.copied : a.copy}</button>
                    {st === "speaking" && <>
                      <button type="button" className="rt-act" onClick={() => { synth?.pause(); setPaused(true); }} disabled={paused}><Icon name="pause" size={15} />{a.pause}</button>
                      <button type="button" className="rt-act" onClick={() => { synth?.resume(); setPaused(false); }} disabled={!paused}><Icon name="play" size={15} />{a.resume}</button>
                      <button type="button" className="rt-act" onClick={stopSpeak}><Icon name="stop" size={15} />{a.stop}</button></>}
                  </div>}
                </>}
              </div>
            </div>)}

          {st === "thinking" && <div className="rt-msg assistant" role="status"><RatchetOrb size="xs" busy /><span className="rt-typing">{a.thinking}<span className="rt-dots" aria-hidden><i /><i /><i /></span></span></div>}
          {stLabel && <div className="rt-typing" role="status"><Icon name={st === "listening" ? "mic" : "speaker"} size={16} />{stLabel}</div>}
        </div>
      </div>

      <div className="rt-compose-wrap">
        <form className="rt-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          {file && <span className="rt-file"><Icon name="clip" size={14} />{file.name}<button type="button" onClick={() => setFile(null)} aria-label={a.removeFile}><Icon name="close" size={14} /></button></span>}
          <textarea ref={taRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} placeholder={a.placeholder} aria-label={a.placeholder}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <div className="rt-tools">
            <label className="rt-tool" title={a.attach}><Icon name="clip" size={16} /><span className="lbl">{a.attach}</span>
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <button type="button" className={"rt-tool" + (st === "listening" ? " live" : "")} onClick={micClick} aria-label={st === "listening" ? a.stopListening : a.speak}><Icon name="mic" size={16} /><span className="lbl">{st === "listening" ? a.stopListening : a.speak}</span></button>
            <button type="button" className="rt-tool" aria-pressed={web} onClick={() => setWeb(!web)}><Icon name="globe" size={16} /><span className="lbl">{a.web}</span></button>
            <button type="submit" className="rt-send" disabled={busy || (!input.trim() && !file)} aria-label={a.send}><Icon name="arrowUp" size={20} /></button>
          </div>
        </form>
        <p className="rt-disc">{a.disclaimer} {a.fileNote}</p>
      </div>
    </section>

    {review && <Modal title={a.confirmTitle} onClose={() => setReview(null)} closeLabel={a.close}>
      <div className="sum">
        <div><span>{a.doctor}</span>{review.summary.doctor}</div><div><span>{a.specialty}</span>{review.summary.specialty}</div>
        <div><span>{a.hospital}</span>{review.summary.hospital}</div><div><span>{a.date}</span>{review.summary.date}</div><div><span>{a.time}</span>{review.summary.time || "-"}</div>
        <div><span>{a.consultFee}</span>{money(lang, review.summary.consultationFeeBdt)}</div>
      </div>
      <div className="banner info">{a.nothingBooked}</div>
      <div className="sheet-actions"><button type="button" className="btn ghost" data-modal-close>{a.cancel}</button><button type="button" className="btn em" onClick={confirmBook} data-autofocus>{a.confirm}</button></div>
    </Modal>}
  </div>;
}

function DoctorCard({ d, onReview }: { d: Doc; onReview: (d: Doc, date: string, time: string) => void }) {
  const { t, lang } = useI18n(); const a = t.ai;
  const today = localToday();
  const [date, setDate] = useState(today), [time, setTime] = useState(d.slots[0] || "");
  const id = "rd-" + d.id;
  return <div className="card rt-doc">
    <h3>{d.name}</h3><p>{d.specialty}{d.qualification && ` · ${d.qualification}`}{d.experience != null && ` · ${fill(a.yrs, { n: num(lang, d.experience) })}`}</p>
    <p><Link href={`/hospitals/${d.hospital.id}`} className="link">{d.hospital.name}</Link>{d.hospital.location && `, ${d.hospital.location}`}</p>
    <p>{[d.visitingDays, d.visitingHours].filter(Boolean).join(" ")}{d.feeBdt ? " · " + fill(a.fee, { p: money(lang, d.feeBdt) }) : ""}</p>
    <div className="two"><div><label htmlFor={id + "-d"}>{a.date}</label><input id={id + "-d"} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><label htmlFor={id + "-t"}>{a.time}</label>{d.slots.length ? <select id={id + "-t"} value={time} onChange={(e) => setTime(e.target.value)}>{d.slots.map((s: string) => <option key={s}>{s}</option>)}</select> : <input id={id + "-t"} value={a.byAppt} disabled />}</div></div>
    <p className="hint">{a.slotNote}</p>
    <div className="row"><Link className="btn ghost sm" href={`/doctors?q=${encodeURIComponent(d.name)}`}>{a.profile}</Link><button type="button" className="btn sm" onClick={() => onReview(d, date, time)}>{a.review}</button></div></div>;
}
