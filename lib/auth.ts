import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "./db";

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
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      if (token.uid && (user || !token.role)) {
        const u = await db.user.findUnique({ where: { id: token.uid as string }, include: { hospital: { select: { id: true } }, ambulanceProvider: { select: { id: true } } } });
        token.role = u?.role; token.hospitalId = u?.hospital?.id; token.providerId = u?.ambulanceProvider?.id;
      }
      return token;
    },
    async session({ session, token }) {
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
