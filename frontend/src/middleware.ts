import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    /*
     * Protect everything except:
     * - /login (the sign-in page)
     * - /api/auth/* (NextAuth endpoints)
     * - /_next/* (static assets)
     * - /favicon.ico, /robots.txt
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)",
  ],
};
