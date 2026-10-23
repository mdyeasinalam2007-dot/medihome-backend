import Icon, { type IconName } from "./ui/Icon";

const ICONS = ["search", "doctor", "bed", "blood", "test", "ambulance", "hospital", "alert", "calendar", "inbox"];

// Empty / error state. `icon` can be one of the built-in icon names, or (for older pages) an emoji.
export default function Empty({ icon, title, text, tone }: { icon: string; title: string; text: string; tone?: "error" }) {
  return <div className={"empty" + (tone === "error" ? " error" : "")} role={tone === "error" ? "alert" : undefined}>
    {ICONS.includes(icon) ? <span className="empty-ic"><Icon name={icon as IconName} size={28} /></span> : <div className="ic" aria-hidden>{icon}</div>}
    <h3>{title}</h3><p>{text}</p>
  </div>;
}

// GET search form. Field names (q, cat, group …) are the existing URL parameters, so links keep working.
export function SearchForm({ q, placeholder, children, label = "Search", button = "Search" }: { q?: string; placeholder: string; children?: React.ReactNode; label?: string; button?: string }) {
  return <form className="search" method="get" role="search" aria-label={label}>
    <div className="search-field"><Icon name="search" /><input name="q" defaultValue={q} placeholder={placeholder} aria-label={label} /></div>
    {children}
    <button className="btn">{button}</button>
  </form>;
}
