import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Old admin payments link, kept so it still works: there is nothing to verify, so it opens the admin page.
export default function OwnerPaymentsPage() {
  redirect("/owner");
}
