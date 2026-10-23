"use client";
import { toast } from "./Toast";
import Icon from "./ui/Icon";
import { useI18n } from "./I18nProvider";

// Short booking reference (last 8 characters, as shown everywhere else) with a copy button.
export default function CopyId({ id }: { id: string }) {
  const { t } = useI18n(); const ref = id.slice(-8).toUpperCase();
  return <span className="copy-id">
    <b className="mono">{ref}</b>
    <button type="button" className="icon-btn sm" aria-label={`${t.bk.copy}: ${ref}`}
      onClick={() => navigator.clipboard?.writeText(ref).then(() => toast(t.bk.copied), () => toast(t.bk.copyFailed, "err"))}><Icon name="clip" size={16} /></button>
  </span>;
}
