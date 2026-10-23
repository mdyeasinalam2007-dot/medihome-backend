"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Scroll-reveal for elements marked .reveal. Safety rules:
//  - Elements are only hidden while <html> has the "js" class (set by a tiny inline script in the layout).
//    Without JavaScript nothing is ever hidden.
//  - If this component never starts (e.g. a script error), the inline script reveals everything after 2.5s.
//  - With reduced motion, CSS never hides anything in the first place.
export default function RevealObserver() {
  const path = usePathname();
  useEffect(() => {
    (window as any).__revealReady = true;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.in)"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [path]);
  return null;
}
