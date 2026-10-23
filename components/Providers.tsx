"use client";
import { SessionProvider } from "next-auth/react";
import { ToastHost } from "./Toast";
import { I18nProvider } from "./I18nProvider";
import type { Lang } from "@/lib/i18n/dictionaries";

// The page wrapper used to start at opacity:0 and only fade in after JavaScript loaded, so slow or failed
// JavaScript meant a blank page. Content is now always visible: the entrance effect is a CSS-only slide
// (see .page-in in globals.css) that never changes opacity and is switched off for reduced-motion users.
export default function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <SessionProvider><I18nProvider lang={lang}><ToastHost />{children}</I18nProvider></SessionProvider>;
}
