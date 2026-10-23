"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, getDictFor, type Dict, type Lang } from "@/lib/i18n/dictionaries";

type Ctx = { lang: Lang; t: Dict; setLang: (l: Lang) => void };
const I18n = createContext<Ctx | null>(null);

// Saves the choice in a first-party cookie (1 year, whole site). Only "en" / "bn" are ever written.
export function writeLangCookie(l: Lang) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LANG_COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function I18nProvider({ lang: initial, children }: { lang: Lang; children: React.ReactNode }) {
  const [lang, setState] = useState<Lang>(initial);
  const router = useRouter();
  useEffect(() => setState(initial), [initial]); // stay in sync after the server re-renders

  const setLang = useCallback((l: Lang) => {
    if (l === lang) return;
    writeLangCookie(l);
    setState(l);                           // client text switches at once
    document.documentElement.lang = l;
    router.refresh();                      // server-rendered text follows; same URL, no reload
  }, [lang, router]);

  return <I18n.Provider value={{ lang, t: getDictFor(lang), setLang }}>{children}</I18n.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18n);
  if (!c) throw new Error("useI18n must be used inside <I18nProvider>");
  return c;
}
