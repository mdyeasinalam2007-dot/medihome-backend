"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const CLOSE_MS = 160; // matches the .modal.closing animation in globals.css

// Accessible dialog: labelled by its title, Esc / backdrop / ✕ close it, Tab stays inside, page scroll is
// locked while open, and focus returns to whatever opened it. Closing plays a short exit animation (instant
// with reduced motion). Any button inside marked data-modal-close also closes it with the animation.
export default function Modal({ title, sub, onClose, closeLabel, children }: { title: string; sub?: string; onClose: () => void; closeLabel: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null), id = useId();
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const closingRef = useRef(false); const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { closeRef.current(); return; }
    setClosing(true);
    window.setTimeout(() => closeRef.current(), CLOSE_MS);
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus]") || ref.current?.querySelector<HTMLElement>("input,select,textarea") || ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); requestClose(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; opener?.focus?.(); };
  }, [requestClose]);

  return (
    <div className={"modal" + (closing ? " closing" : "")} onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={id + "t"} ref={ref}
        onClick={(e) => { if ((e.target as HTMLElement).closest("[data-modal-close]")) requestClose(); }}>
        <div className="sheet-head">
          <div><h2 id={id + "t"}>{title}</h2>{sub && <p className="sheet-sub">{sub}</p>}</div>
          <button type="button" className="icon-btn" onClick={requestClose} aria-label={closeLabel}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
