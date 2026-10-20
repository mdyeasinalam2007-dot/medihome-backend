import Link from "next/link";
export default function Home() {
  const S = [["/doctors", "🩺", "Doctors", "Find specialists and book appointment slots."], ["/beds", "🛏️", "Beds & Accommodation", "ICU, CCU, cabins, wards and more."], ["/blood", "🩸", "Blood Bank", "See blood units listed by hospitals."], ["/tests", "🧪", "Diagnostic Tests", "Book lab or home sample collection."], ["/ambulance", "🚑", "Ambulance", "Request a registered ambulance service."]];
  return <>
    <h1>Care that comes <em>home</em> to you.</h1>
    <p className="sub">Search registered hospitals for doctors, beds, blood and tests. A flat BDT 10 service fee via bKash confirms your booking request.</p>
    <form className="search" action="/doctors"><input name="q" placeholder="Search doctors, specialties or hospitals…" aria-label="Search" /><button className="btn">Search</button></form>
    <div className="grid">{S.map((s) => <Link key={s[0]} href={s[0]} className="card"><div style={{ fontSize: 30 }}>{s[1]}</div><h3>{s[2]}</h3><p>{s[3]}</p></Link>)}</div>
    <div className="grid"><div className="card"><h3>For patients</h3><p>Create a free account to book and track your history.</p><div className="row"><Link className="btn" href="/register">Sign up</Link></div></div>
    <div className="card"><h3>For hospitals</h3><p>Publish doctors, beds, blood stock and tests from your own portal.</p><div className="row"><Link className="btn em" href="/register?role=hospital">Register hospital</Link></div></div>
    <div className="card"><h3>AI Health Assistant</h3><p>Symptom guidance and report explanations in your language.</p><div className="row"><Link className="btn ghost" href="/assistant">Open assistant</Link></div></div></div></>;
}
