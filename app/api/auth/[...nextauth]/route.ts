import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionOnlyCookies } from "@/lib/remember";

const h = NextAuth(authOptions);
// Same NextAuth handler as before; the only change is the "Remember me" cookie lifetime (see lib/remember.ts).
async function handler(req: Request, ctx: any) { return sessionOnlyCookies(req, await h(req, ctx)); }
export { handler as GET, handler as POST };
