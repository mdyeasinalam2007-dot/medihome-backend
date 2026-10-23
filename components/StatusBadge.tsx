import Icon, { type IconName } from "./ui/Icon";
import type { Tone } from "@/lib/status";

// Status is always shown as text + icon + colour (never colour alone).
const ICON: Record<Tone, IconName | null> = { ok: "check", warn: "clock", bad: "alert", info: "check", neutral: "close" };
export default function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  const ic = ICON[tone];
  return <span className={"badge " + tone}>{ic && <Icon name={ic} size={14} />}{label}</span>;
}
