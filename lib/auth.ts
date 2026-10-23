import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { isRevoked, lastRevocation } from "./sessionRevocation";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, SHORT_SESSION_MS } from "./remember";

// "Remember me" choice of THIS browser at sign-in time (no cookie = remembered, the previous behaviour).
function rememberChoice(): boolean { try { return cookies().get(REMEMBER_COOKIE)?.value !== "0"; } catch { return true; } }

if (process.env.RENDER_EXTERNAL_URL) {
  process.env.NEXTAUTH_URL = process.env.RENDER_EXTERNAL_URL;
}

const providers: any[] = [
  Credentials({
    name: "Email",
    credentials: { email: {}, password: {} },
    async authorize(c) {
      if (!c?.email || !c.password) return null;
      const u = await db.user.findUnique({ where: { email: c.email.toLowerCase().trim() } });
      if (!u?.passwordHash || !(await bcrypt.compare(c.password, u.passwordHash))) return null;
      return { id: u.id, name: u.name, email: u.email };
    },
  }),
];
// Social buttons exist only when real credentials are configured.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  providers.push(Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }));
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET)
  providers.push(Facebook({ clientId: process.env.FACEBOOK_CLIENT_ID, clientSecret: process.env.FACEBOOK_CLIENT_SECRET }));

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  // Each browser/device holds its own signed, HttpOnly session cookie; nothing about a session is shared between devices.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 }, // "Remember me" length; shorter sessions are enforced in jwt() below
  pages: { signIn: "/login", error: "/login" }, // OAuth problems (cancelled, denied, not linked) come back to sign-in with ?error=
  providers,
  callbacks: {
    // Google / Facebook are for patients only. New users are created as PATIENT (database default) and never get
    // other roles from OAuth. Accounts are NOT linked by matching email (allowDangerousEmailAccountLinking is off),
    // so an OAuth login can never take over an existing password account: NextAuth answers "OAuthAccountNotLinked".
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      if (account.provider === "google" && (profile as any)?.email_verified !== true) return false; // unverified Google email
      const existing = user?.id ? await db.user.findUnique({ where: { id: user.id }, select: { role: true } }).catch(() => null) : null;
      if (existing && existing.role !== "PATIENT") return false; // hospital / ambulance accounts sign in with email + password
      return true;
    },
    async jwt({ token, user }) {
      if (user) { token.uid = user.id; token.authAt = Date.now(); token.rem = rememberChoice(); } // authAt: when this session signed in
      // not remembered: the session also ends on the server after SHORT_SESSION_MS (browsers can restore "session" cookies)
      if (token.uid && token.rem === false && Date.now() - Number(token.authAt || 0) > SHORT_SESSION_MS) return {} as any;
      if (token.uid) {
        try { // a password reset (or account deletion) after this sign-in ends the session
          if (isRevoked(token.authAt, await lastRevocation(token.uid as string))) return {} as any;
        } catch (e: any) { console.error("Session check skipped:", e?.name || "error"); } // database blip: keep the session rather than sign everyone out
      }
      if (token.uid && (user || !token.role)) {
        const u = await db.user.findUnique({ where: { id: token.uid as string }, include: { hospital: { select: { id: true } }, ambulanceProvider: { select: { id: true } } } });
        token.role = u?.role; token.hospitalId = u?.hospital?.id; token.providerId = u?.ambulanceProvider?.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token?.uid) { (session as any).user = undefined; return session; } // revoked or empty session = signed out
      Object.assign(session.user as any, { id: token.uid, role: token.role, hospitalId: token.hospitalId, providerId: token.providerId });
      return session;
    },
  },
};

export type Me = { id: string; role: "PATIENT" | "HOSPITAL" | "AMBULANCE"; hospitalId?: string; providerId?: string; name?: string };
export async function me(): Promise<Me | null> {
  const s = await getServerSession(authOptions);
  return (s?.user as any)?.id ? (s!.user as any) : null;
}
