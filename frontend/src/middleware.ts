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
     * - /proxy/api/telegram/webhook (Telegram bot — has its own secret token auth)
     * - /_next/* (static assets)
     * - /favicon.ico, /robots.txt
     */
    "/((?!login|api/auth|api/telegram|proxy/api/telegram/webhook|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)",
  ],
};
