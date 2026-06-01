import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Service-role client — BYPASSES Row-Level Security.
 *
 * Use this ONLY for trusted system paths that legitimately need to act outside
 * a single user's RLS scope:
 *   - OAuth token refresh writes (lib/google/client.ts)
 *   - account deletion / data purge (Limited Use cleanup)
 *   - admin provisioning scripts
 *
 * For anything driven by a request on behalf of a signed-in EA, use
 * `supabaseUser(accessToken)` instead so RLS enforces tenant isolation.
 */
export function supabaseServer(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * RLS-respecting client scoped to a single signed-in EA.
 *
 * The user's Supabase access token (issued by signInWithPassword during login,
 * carried in the NextAuth JWT — see auth.ts) is sent as the Authorization
 * Bearer header. PostgREST then runs every query as the `authenticated` role
 * with `auth.uid()` set to that user, so the RLS policies in migration 0006
 * are actually enforced: an EA can only read/write their own rows even if an
 * app-layer owner filter is ever missed.
 *
 * Not cached — each request carries its own token. Uses the anon key as the
 * apikey (RLS still applies); the Bearer token is what establishes identity.
 */
export function supabaseUser(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
