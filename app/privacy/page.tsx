import InfoPage from "@/components/InfoPage";
import { getDict } from "@/lib/i18n/server";
export default function Page() { const t = getDict().info; return <InfoPage icon="user" title={t.privacyTitle} note={t.privacyDraft} items={t.privacy.map((s) => ({ s }))} />; }
