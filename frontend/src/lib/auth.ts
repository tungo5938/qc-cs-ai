import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const GHN_DOMAIN_RE = /^[^@]+@(ghn\.vn|ghn\.com\.vn)$/i;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email || "";
      // Always allow GHN domain accounts
      if (GHN_DOMAIN_RE.test(email)) return true;
      // Check additional allowed emails stored in backend
      try {
        const api = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
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
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
};
