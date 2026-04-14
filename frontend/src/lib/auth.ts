import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const SUPER_ADMINS = ["tunm1@ghn.vn", "giangh@ghn.vn"];

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = (user.email || "").toLowerCase();
      // Super admins always allowed
      if (SUPER_ADMINS.includes(email)) return true;
      // All other accounts must be explicitly approved
      try {
        const api = process.env.API_BASE_URL || "http://localhost:8000";
        const res = await fetch(
          `${api}/api/auth/allowed-emails/check?email=${encodeURIComponent(email)}`
        );
        if (res.ok) {
          const data = await res.json();
          return data.allowed === true;
        }
      } catch {}
      return "/login?error=AccessDenied";
    },
    async jwt({ token, user }) {
      if (user) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.email = token.email as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
};
