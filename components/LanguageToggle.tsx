"use client";
import { useI18n } from "./I18nProvider";
import { LANGS } from "@/lib/i18n/dictionaries";

// Two-button switch. Changing language keeps you on the same URL (see I18nProvider).
export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, t, setLang } = useI18n();
  return (
    <div className={"lang " + className} data-lang={lang} role="group" aria-label={t.lang.label}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} className={lang === l ? "on" : ""} onClick={() => setLang(l)}>
          {t.lang[l]}
        </button>
      ))}
    </div>
  );
}
