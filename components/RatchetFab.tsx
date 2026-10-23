"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RatchetOrb from "./ui/RatchetOrb";
import { useI18n } from "./I18nProvider";

// Floating Ratchet AI button (bottom-right) on every page except the Ratchet page itself.
// It is only a link: the Ratchet page keeps its own sign-in requirement, so nothing is bypassed.
export default function RatchetFab() {
  const path = usePathname(); const { t } = useI18n();
  if (path === "/assistant" || path?.startsWith("/assistant/")) return null;
  return <Link href="/assistant" className="rt-fab" aria-label={t.nav.openRatchet} title={t.nav.openRatchet}>
    <RatchetOrb size="md" /><span className="rt-fab-label" aria-hidden>{t.nav.ratchet}</span>
  </Link>;
}
