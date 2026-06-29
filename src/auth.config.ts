import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma";

/**
 * Config base, segura para el Edge runtime (sin Prisma ni bcrypt).
 * La usa el middleware. auth.ts la extiende con el provider Credentials.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // se añaden en auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
