"use client";
import { SessionProvider } from "next-auth/react";
import { motion } from "framer-motion";
import { ToastHost } from "./Toast";
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><ToastHost /><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>{children}</motion.div></SessionProvider>;
}
