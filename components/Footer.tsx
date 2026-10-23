import Link from "next/link";
import Icon from "./ui/Icon";
import { Logo } from "./Nav";
import type { Dict } from "@/lib/i18n/dictionaries";

// Server component: receives the dictionary from the layout, so it needs no JavaScript in the browser.
export default function Footer({ t }: { t: Dict }) {
  const care: [string, string][] = [["/doctors", t.nav.doctors], ["/hospitals", t.nav.hospitals], ["/beds", t.nav.beds], ["/blood", t.nav.blood], ["/tests", t.nav.tests], ["/ambulance", t.nav.ambulance], ["/assistant", t.nav.ratchet]];
  return (
    <footer className="foot">
      <div className="foot-glow" aria-hidden />
      <div className="in">
        <div className="foot-brand">
          <p className="foot-logo"><Logo size={30} /><span>Medi<b>Home</b></span></p>
          <p>{t.footer.tagline}</p>
          <a href="tel:999" className="foot-em"><Icon name="alert" size={18} /><span><b>{t.footer.emergencyTitle}</b><br />{t.footer.emergencyText}</span></a>
        </div>
        <nav aria-label={t.footer.findCare}><p className="foot-h">{t.footer.findCare}</p><ul>{care.map(([h, l]) => <li key={h}><Link href={h}>{l}</Link></li>)}</ul></nav>
        <nav aria-label={t.footer.providers}><p className="foot-h">{t.footer.providers}</p><ul>
          <li><Link href="/register?role=hospital">{t.footer.registerHospital}</Link></li>
          <li><Link href="/register?role=ambulance">{t.footer.registerAmbulance}</Link></li>
          <li><Link href="/portal">{t.footer.hospitalPortal}</Link></li>
        </ul></nav>
        <nav aria-label={t.footer.support}><p className="foot-h">{t.footer.support}</p><ul>
          <li><Link href="/help">{t.footer.help}</Link></li><li><Link href="/terms">{t.footer.terms}</Link></li><li><Link href="/privacy">{t.footer.privacy}</Link></li>
        </ul></nav>
      </div>
      <div className="in foot-legal"><p>© {new Date().getFullYear()} MediHome</p><p>{t.footer.disclaimer}</p></div>
    </footer>
  );
}
