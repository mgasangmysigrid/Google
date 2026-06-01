import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    /**
     * Supabase access token for the signed-in EA. Used by supabaseUser() to run
     * RLS-scoped queries on the user's behalf. Not exposed to the browser-facing
     * session shape beyond what route handlers read server-side.
     */
    supabaseAccessToken?: string;
  }
}

// next-auth v5 (beta) re-exports the JWT type from @auth/core/jwt; augment both
// module specifiers so the callback `token` is correctly typed regardless of
// which one the compiler resolves.
declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    supabaseAccessToken?: string;
    supabaseRefreshToken?: string;
    supabaseExpiresAt?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    /** Supabase uid (auth.uid()). */
    sub?: string;
    /** Supabase access token (RLS bearer). */
    supabaseAccessToken?: string;
    /** Supabase refresh token, used to mint a fresh access token on expiry. */
    supabaseRefreshToken?: string;
    /** Epoch ms at which supabaseAccessToken expires. */
    supabaseExpiresAt?: number;
  }
}
