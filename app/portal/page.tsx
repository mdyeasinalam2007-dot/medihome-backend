import { redirect } from "next/navigation";
import { me } from "@/lib/auth";
import { loginFor } from "@/lib/safeNext";
import Portal from "@/components/Portal";
export const dynamic = "force-dynamic";
export default async function PortalPage() {
  const u = await me(); if (!u) redirect(loginFor("/portal")); if (u.role !== "HOSPITAL") redirect("/dashboard");
  return <Portal />;
}
