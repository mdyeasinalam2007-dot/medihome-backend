import InfoPage from "@/components/InfoPage";
import { getDict } from "@/lib/i18n/server";
export default function Page() { const t = getDict().info; return <InfoPage icon="help" title={t.helpTitle} sub={t.helpSub} items={t.help} />; }
