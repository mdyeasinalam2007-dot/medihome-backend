import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali, Fraunces, Noto_Serif_Bengali } from "next/font/google";
import { Suspense } from "react";
import Providers from "@/components/Providers";
import RatchetFab from "@/components/RatchetFab";
import SoundExperience from "@/components/SoundExperience";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import NavProgress from "@/components/NavProgress";
import RevealObserver from "@/components/RevealObserver";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";

// Fonts are downloaded once at build time and served from this site (no third-party requests at runtime).
const latin = Inter({ subsets: ["latin"], display: "swap", variable: "--font-latin" });
const bangla = Noto_Sans_Bengali({ subsets: ["bengali"], display: "swap", variable: "--font-bn" });
const display = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-display", axes: ["opsz"] });
const displayBn = Noto_Serif_Bengali({ subsets: ["bengali"], display: "swap", variable: "--font-display-bn" });

// Marks that JavaScript runs (scroll-reveal may then start elements slightly faded). If the reveal script
// never starts, everything is revealed after 2.5s, so content can never stay hidden.
const REVEAL_BOOT = `document.documentElement.classList.add("js");setTimeout(function(){if(!window.__revealReady)document.documentElement.classList.add("reveal-all")},2500);`;

export function generateMetadata(): Metadata {
  const t = getDictFor(getLang());
  return { title: t.meta.title, description: t.meta.description };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1f3a" };

export default function Root({ children }: { children: React.ReactNode }) {
  const lang = getLang(), t = getDictFor(lang);
  return (
    <html lang={lang} className={`${latin.variable} ${bangla.variable} ${display.variable} ${displayBn.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} /></head>
      <body>
        <Providers lang={lang}>
          <Suspense fallback={null}><NavProgress /></Suspense>
          <Nav />
          <main id="main" className="wrap page-in" tabIndex={-1}>{children}</main>
          <Footer t={t} />
          <RatchetFab />
          <SoundExperience />
          <RevealObserver />
        </Providers>
      </body>
    </html>
  );
}
