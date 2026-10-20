"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
export default function Nav() {
  const { data } = useSession(); const u: any = data?.user;
  return (
    <header className="nav"><div className="in">
      <Link href="/" className="brand" aria-label="MediHome home">
        <svg width="30" height="30" viewBox="0 0 48 48" fill="none" aria-hidden><path d="M24 5 6 20v22h36V20z" fill="#eff6ff" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round"/><path d="M21 15h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill="#059669"/><path d="M4 31h9l3-6 4 10 4-14 3 10h17" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Medi<b>Home</b></Link>
      <Link className="l" href="/doctors">Doctors</Link><Link className="l" href="/beds">Beds</Link><Link className="l" href="/blood">Blood Bank</Link>
      <Link className="l" href="/tests">Tests</Link><Link className="l" href="/ambulance">Ambulance</Link><Link className="l" href="/hospitals">Hospitals</Link><Link className="l" href="/assistant">AI Consultant</Link>
      <span className="sp" />
      {u ? (<>
        <Link className="l" href={u.role === "HOSPITAL" ? "/portal" : u.role === "AMBULANCE" ? "/provider" : "/dashboard"}>{u.role === "HOSPITAL" ? "Hospital Portal" : u.role === "AMBULANCE" ? "Ambulance Portal" : "My Dashboard"}</Link>
        <button className="l" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button></>
      ) : <Link className="btn sm" href="/login">Sign in</Link>}
    </div></header>
  );
}
