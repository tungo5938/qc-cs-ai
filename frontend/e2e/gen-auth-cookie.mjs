/**
 * Generate a valid NextAuth v4 JWE session cookie for Playwright tests.
 * Uses next-auth/jwt encode to match exactly what NextAuth produces.
 * Run: node e2e/gen-auth-cookie.mjs
 */
import { encode } from "next-auth/jwt";
import { writeFileSync } from "fs";

const secret = "local-dev-secret-change-in-prod";
const email = "tunm1@ghn.vn";
const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 30; // 30 days

const token = await encode({
  token: {
    email,
    name: email,
    picture: null,
    sub: email,
    iat: now,
    exp,
    jti: crypto.randomUUID(),
  },
  secret,
  maxAge: 60 * 60 * 24 * 30,
});

const state = {
  cookies: [
    {
      name: "next-auth.session-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      expires: exp,
    },
  ],
  origins: [],
};

writeFileSync("e2e/auth-state.json", JSON.stringify(state, null, 2));
console.log("Written e2e/auth-state.json");
console.log("Token preview:", token.slice(0, 40) + "...");
