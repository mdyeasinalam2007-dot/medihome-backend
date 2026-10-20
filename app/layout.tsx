import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Providers from "@/components/Providers";
import Nav from "@/components/Nav";
export const metadata: Metadata = { title: "MediHome - Doctors, Beds, Blood & Tests", description: "Book doctors, hospital beds, blood and diagnostic tests from registered hospitals in Bangladesh." };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers><Nav /><main className="wrap">{children}</main>
    <footer className="foot"><Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/help">Help</Link><br />MediHome provides general information and booking services, not medical advice. Emergency: call 999.</footer></Providers></body></html>;
}
