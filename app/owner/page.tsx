import type { Metadata } from "next";
import OwnerAdmin from "@/components/OwnerAdmin";
export const metadata: Metadata = { title: "Admin - MediHome", robots: { index: false, follow: false } };
export default function OwnerPage() { return <OwnerAdmin />; }
