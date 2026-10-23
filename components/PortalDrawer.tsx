"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import Icon, { type IconName } from "./ui/Icon";
import RatchetOrb from "./ui/RatchetOrb";
import LanguageToggle from "./LanguageToggle";
import type { Dict } from "@/lib/i18n/dictionaries";

type Item = [href: string, label: string, icon: IconName];
type User = { role?: string; name?: string | null; email?: string | null } | null;

// Builds the drawer links for the signed-in user's own role. Only existing routes are used.
// This is navigation only: every page and API still checks permissions on the server.
export function portalItems(user: User, t: Dict): { title: string; items: Item[] } {
  const d = t.drawer;
  if (user?.role === "PATIENT") return { title: d.yours, items: [
    ["/dashboard", d.patient.dashboard, "dashboard"], ["/dashboard#upcoming", d.patient.upcoming, "calendar"], ["/dashboard#requests", d.patient.requests, "clock"],
    ["/dashboard#past", d.patient.history, "check"], ["/dashboard#ambulance", d.patient.ambulance, "ambulance"], ["/dashboard#profile", d.patient.profile, "user"]] };
  if (user?.role === "HOSPITAL") return { title: d.yours, items: [
    ["/portal#bookings", d.hospital.bookings, "inbox"], ["/portal#doctors", d.hospital.doctors, "doctor"], ["/portal#accommodations", d.hospital.beds, "bed"],
    ["/portal#blood", d.hospital.blood, "blood"], ["/portal#tests", d.hospital.tests, "test"], ["/portal#ambulance", d.hospital.ambulance, "ambulance"],
    ["/portal#profile", d.hospital.profile, "hospital"], ["/portal#billing", d.hospital.billing, "card"]] };
  if (user?.role === "AMBULANCE") return { title: d.yours, items: [
    ["/provider#requests", d.provider.requests, "inbox"], ["/provider#fleet", d.provider.fleet, "ambulance"]] };
  return { title: "", items: [] };
}
const homeOf = (role?: string) => (role === "HOSPITAL" ? ["/portal", "hospital"] : role === "AMBULANCE" ? ["/provider", "ambulance"] : ["/dashboard", "dashboard"]) as [string, IconName];

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function PortalDrawer({ open, onClose, user, t, path }: { open: boolean; onClose: () => void; user: User; t: Dict; path: string }) {
  const d = t.drawer, panel = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false), [hash, setHash] = useState("");
  const close = useCallback(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { onClose(); return; }
    setClosing(true); window.setTimeout(() => { setClosing(false); onClose(); }, 200);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setHash(window.location.hash);
    const opener = document.activeElement as HTMLElement | null, prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const els = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
      if (!els.length) return; const a = els[0], z = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; opener?.focus?.(); };
  }, [open, close]);

  if (!open) return null;
  const { title, items } = portalItems(user, t);
  const isActive = (href: string) => { const [p, h] = href.split("#"); return p === path && (h ? hash === "#" + h : !hash || !items.some((i) => i[0] === p + hash)); };
  const link = ([href, label, ic]: Item, extra = "") => (
    <li key={href}><Link href={href} className={"dl " + extra} aria-current={isActive(href) ? "page" : undefined} onClick={close}>
      <span className={"dl-ic" + (ic === "ai" ? " is-orb" : "")}>{ic === "ai" ? <RatchetOrb size="xs" /> : <Icon name={ic} size={18} />}</span><span className="dl-t">{label}</span><Icon name="arrow" size={16} className="dl-go" /></Link></li>);
  const [home, homeIc] = homeOf(user?.role);
  const homeLabel = user?.role === "HOSPITAL" ? d.hospital.portal : user?.role === "AMBULANCE" ? d.provider.portal : d.patient.dashboard;
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className={"drawer-wrap" + (closing ? " closing" : "")} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside id="portal-drawer" className="drawer" role="dialog" aria-modal="true" aria-label={d.label} ref={panel}>
        <div className="drawer-head">
          {user ? <div className="who"><span className="who-av" aria-hidden>{initial}</span>
            <div><p className="who-name">{user.name || user.email}</p><p className="who-role"><span className="dot" aria-hidden />{d.signedIn} · {d.roles[user.role || ""] || ""}</p></div></div>
            : <div className="who"><span className="who-av guest" aria-hidden><Icon name="heartPulse" size={20} /></span><div><p className="who-name">{d.guestTitle}</p><p className="who-role">{d.guestText}</p></div></div>}
          <button type="button" className="icon-btn" onClick={close} aria-label={d.close} data-autofocus><Icon name="close" /></button>
        </div>

        <nav className="drawer-body" aria-label={d.label}>
          {user ? <>
            <p className="dh">{title}</p>
            <ul className="dlist">{link([home, homeLabel, homeIc], "primary")}{items.filter((i) => i[0] !== home).map((i) => link(i))}</ul>
          </> : <div className="drawer-cta">
            <Link className="btn" href="/login" onClick={close}>{d.guest.signIn}</Link>
            <Link className="btn ghost" href="/register" onClick={close}>{d.guest.register}</Link>
          </div>}
          <p className="dh">{d.explore}</p>
          <ul className="dlist">
            {link(["/assistant", d.ratchet, "ai"])}
            {!user && link(["/register?role=hospital", d.guest.regHospital, "hospital"])}
            {!user && link(["/register?role=ambulance", d.guest.regAmb, "ambulance"])}
            {link(["/help", d.help, "help"])}
          </ul>
          <div className="drawer-lang"><span>{t.lang.label}</span><LanguageToggle /></div>
        </nav>

        <div className="drawer-foot">
          <a href="tel:999" className="btn sos"><Icon name="phone" size={18} />{t.nav.call999}</a>
          {user && <button type="button" className="btn ghost" onClick={() => signOut({ callbackUrl: "/" })}><Icon name="logout" size={18} />{d.signOut}</button>}
        </div>
      </aside>
    </div>
  );
}
