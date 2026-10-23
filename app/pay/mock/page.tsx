import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Old payment link, kept so existing links still work. MediHome takes no online payments,
// so this simply takes the visitor to their dashboard.
export default function Mock() {
  redirect("/dashboard");
}
