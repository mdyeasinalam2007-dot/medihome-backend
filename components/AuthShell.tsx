"use client";
import Icon from "./ui/Icon";
import { Logo } from "./Nav";
import { useI18n } from "./I18nProvider";

// Shared layout for sign-in, registration and password pages: a branded panel beside the form
// (the panel is hidden on small screens so the form comes first).
export default function AuthShell({ title, sub, children, wide }: { title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  const { t } = useI18n(); const a = t.auth;
  return (
    <div className={"auth" + (wide ? " wide" : "")}>
      <aside className="auth-side" aria-hidden>
        <div className="auth-glow" />
        <p className="auth-logo"><Logo size={36} /><span>Medi<b>Home</b></span></p>
        <h2>{a.sideTitle}</h2>
        <p>{a.sideText}</p>
        <ul>{a.perks.map((p) => <li key={p}><Icon name="check" size={18} />{p}</li>)}</ul>
      </aside>
      <section className="auth-main">
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
        {children}
      </section>
    </div>
  );
}
