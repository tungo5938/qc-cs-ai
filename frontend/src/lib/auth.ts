import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const GHN_DOMAIN_RE = /^[^@]+@(ghn\.vn|ghn\.com\.vn)$/i;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email GHN", type: "email", placeholder: "ten@ghn.vn" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").toLowerCase().trim();
        const password = credentials?.password || "";
        const secret = process.env.ACCESS_PASSWORD;

        if (!secret || password !== secret) return null;

        // GHN domain always allowed
        if (GHN_DOMAIN_RE.test(email)) {
          return { id: email, email, name: email.split("@")[0] };
        }

        // Check additional allowed emails in backend
        try {
          const api = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
          const res = await fetch(
            `${api}/api/auth/allowed-emails/check?email=${encodeURIComponent(email)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.allowed) return { id: email, email, name: email.split("@")[0] };
          }
        } catch {}

        return null;
      },
    }),
  ],
  callbacks: {
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
