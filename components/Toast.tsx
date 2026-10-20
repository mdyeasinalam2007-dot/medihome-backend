"use client";
import { useEffect, useState } from "react";
export function toast(msg: string, kind: "ok" | "err" = "ok") { window.dispatchEvent(new CustomEvent("mh-toast", { detail: { msg, kind } })); }
export function ToastHost() {
  const [t, setT] = useState<{ msg: string; kind: string } | null>(null);
  useEffect(() => {
    let id: any; const h = (e: any) => { setT(e.detail); clearTimeout(id); id = setTimeout(() => setT(null), 2800); };
    window.addEventListener("mh-toast", h); return () => window.removeEventListener("mh-toast", h);
  }, []);
  return t ? <div className={"toast " + (t.kind === "err" ? "err" : "")} role="status">{t.msg}</div> : null;
}
