import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";

import { rateLimit, clientIp } from "@/lib/rate-limit";

// A fresh, session-less Supabase client used only to verify credentials and to
// refresh access tokens. It must NOT persist sessions (this runs server-side,
// per-request) — we carry the resulting tokens in the NextAuth JWT ourselves.
function supabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Per-EA authentication against Supabase Auth. Accounts are provisioned by
      // an admin (scripts/create-ea.ts) — there is no public sign-up. Each EA
      // has their own credentials; the returned id is the Supabase uid that all
      // RLS policies key off (auth.uid()). Gmail authorization is still a
      // separate, explicit step, so logging in grants no Google access.
      async authorize(creds, request) {
        // Brute-force protection: cap sign-in attempts per client IP
        // (CASA ASVS V2.2 anti-automation). Returns null on lockout, which
        // NextAuth surfaces as a failed login.
        const ip = clientIp(request as unknown as Request);
        if (!rateLimit(`login:${ip}`, 10, 60_000).ok) return null;

        const email = (creds?.email as string | undefined)?.trim().toLowerCase();
        const password = creds?.password as string | undefined;
        if (!email || !password) return null;

        const { data, error } = await supabaseAuthClient().auth.signInWithPassword({
          email,
          password,
        });
        // Generic failure on any auth error or missing session — never leak
        // whether the email exists vs the password was wrong.
        if (error || !data.session || !data.user) return null;

        return {
          id: data.user.id,
          email: data.user.email ?? email,
          name:
            (data.user.user_metadata?.full_name as string | undefined) ??
            data.user.email ??
            email,
          // Threaded into the JWT by the jwt() callback below.
          supabaseAccessToken: data.session.access_token,
          supabaseRefreshToken: data.session.refresh_token,
          supabaseExpiresAt: data.session.expires_at
            ? data.session.expires_at * 1000
            : undefined,
        } as unknown as { id: string };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: copy the Supabase identity + tokens onto the JWT.
      if (user) {
        const u = user as unknown as {
          id: string;
          supabaseAccessToken?: string;
          supabaseRefreshToken?: string;
          supabaseExpiresAt?: number;
        };
        token.sub = u.id;
        token.supabaseAccessToken = u.supabaseAccessToken;
        token.supabaseRefreshToken = u.supabaseRefreshToken;
        token.supabaseExpiresAt = u.supabaseExpiresAt;
        return token;
      }

      // Subsequent requests: refresh the Supabase access token shortly before it
      // expires so RLS-scoped queries keep working across the NextAuth session.
      const expiresAt = token.supabaseExpiresAt ?? 0;
      const needsRefresh = Date.now() > expiresAt - 60_000; // 60s skew
      if (needsRefresh && token.supabaseRefreshToken) {
        const { data, error } = await supabaseAuthClient().auth.refreshSession({
          refresh_token: token.supabaseRefreshToken,
        });
        if (!error && data.session) {
          token.supabaseAccessToken = data.session.access_token;
          token.supabaseRefreshToken = data.session.refresh_token;
          token.supabaseExpiresAt = data.session.expires_at
            ? data.session.expires_at * 1000
            : undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      session.supabaseAccessToken = token.supabaseAccessToken;
      return session;
    },
  },
});
