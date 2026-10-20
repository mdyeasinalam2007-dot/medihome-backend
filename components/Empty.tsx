export default function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="empty"><div className="ic" aria-hidden>{icon}</div><h3>{title}</h3><p>{text}</p></div>;
}
export function SearchForm({ q, placeholder, children }: { q?: string; placeholder: string; children?: React.ReactNode }) {
  return <form className="search" method="get"><input name="q" defaultValue={q} placeholder={placeholder} aria-label="Search" />{children}<button className="btn">Search</button></form>;
}
