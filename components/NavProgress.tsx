"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Thin progress bar at the top while moving between pages. It replaces app/loading.tsx, whose streaming
// skeleton hid page content until JavaScript ran. This bar never hides content: without JavaScript it simply
// never appears, and the browser's own loading indicator is used.
export default function NavProgress() {
  const path = usePathname(), search = useSearchParams()?.toString();
  const [state, setState] = useState<"idle" | "run" | "done">("idle");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target || a.hasAttribute("download") || a.getAttribute("href")?.startsWith("#")) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return;
      if (u.pathname === location.pathname && u.search === location.search) return; // same page (or just a #hash)
      setState("run");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  useEffect(() => { setState((s) => (s === "run" ? "done" : s)); }, [path, search]); // new page has arrived
  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), state === "done" ? 450 : 12000); // never stay stuck
    return () => window.clearTimeout(t);
  }, [state]);

  return <div className={"navprog " + state} aria-hidden="true" />;
}
