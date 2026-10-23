"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "./I18nProvider";
import LanguageToggle from "./LanguageToggle";
import PortalDrawer from "./PortalDrawer";
import Icon from "./ui/Icon";

export const Logo = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
    <defs><linearGradient id="mh-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#14b8a6" /><stop offset=".55" stopColor="#6d28d9" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient></defs>
    <rect width="40" height="40" rx="11" fill="url(#mh-g)" />
    <path d="M20 9 9 18v13h22V18z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M18.4 17h3.2v3.4H25v3.2h-3.4V27h-3.2v-3.4H15v-3.2h3.4z" fill="#fff" />
  </svg>
);

// Public navigation is the same for everyone (signed in or not). Personal portal links live in the ⋯ drawer.
export default function Nav() {
  const { data } = useSession(); const u: any = data?.user;
  const { t } = useI18n(); const path = usePathname() || "/";
  const [open, setOpen] = useState(false); const btn = useRef<HTMLButtonElement>(null);
  const links: [string, string, boolean?][] = [["/", t.nav.home], ["/doctors", t.nav.doctors], ["/hospitals", t.nav.hospitals], ["/beds", t.nav.beds],
    ["/blood", t.nav.blood], ["/tests", t.nav.tests], ["/ambulance", t.nav.ambulance], ["/assistant", t.nav.ratchet, true]];
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  const cur = (href: string) => (active(href) ? { "aria-current": "page" as const } : {});

  return (
    <>
      <a className="skip" href="#main">{t.nav.skip}</a>
      <div className="topbar"><div className="in">
        <span className="tb-note"><Icon name="shield" size={14} />{t.home.trust[0]}</span>
        <a href="tel:999" className="topbar-em"><Icon name="phone" size={14} />{t.nav.emergencyLine}</a>
      </div></div>
      <header className="nav">
        <div className="in">
          <Link href="/" className="brand" aria-label="MediHome home"><Logo /><span>Medi<b>Home</b></span></Link>
          <nav className="nav-links" aria-label={t.nav.main}>
            {links.map(([href, label]) => <Link key={href} className="l" href={href} {...cur(href)}>{label}</Link>)}
          </nav>
          <span className="sp" />
          <LanguageToggle className="nav-lang" />
          {!u && <Link className="btn sm get-started" href="/register">{t.nav.getStarted}</Link>}
          <button ref={btn} type="button" className={"dots" + (u ? " signed" : "")} aria-haspopup="dialog" aria-expanded={open} aria-controls="portal-drawer"
            aria-label={t.drawer.open} onClick={() => setOpen(true)}>
            {u ? <span className="dots-av" aria-hidden>{String(u.name || u.email || "?").trim().charAt(0).toUpperCase()}</span> : null}
            <Icon name="more" size={20} />
          </button>
        </div>
        <nav className="nav-scroll" aria-label={t.nav.main}>
          {links.map(([href, label]) => <Link key={href} className="pill" href={href} {...cur(href)}>{label}</Link>)}
        </nav>
      </header>
      <PortalDrawer open={open} onClose={() => { setOpen(false); }} user={u ? { role: u.role, name: u.name, email: u.email } : null} t={t} path={path} />
    </>
  );
}
