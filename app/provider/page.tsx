import { redirect } from "next/navigation";
import { me } from "@/lib/auth";
import { loginFor } from "@/lib/safeNext";
import ProviderPortal from "@/components/ProviderPortal";
export const dynamic = "force-dynamic";
export default async function ProviderPage() {
  const u = await me(); if (!u) redirect(loginFor("/provider")); if (u.role !== "AMBULANCE") redirect("/dashboard");
  return <ProviderPortal />;
}
