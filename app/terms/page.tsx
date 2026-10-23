import InfoPage from "@/components/InfoPage";
import { getDict } from "@/lib/i18n/server";
export default function Page() { const t = getDict().info; return <InfoPage icon="shield" title={t.termsTitle} note={t.termsDraft} items={t.terms.map((s) => ({ s }))} />; }
