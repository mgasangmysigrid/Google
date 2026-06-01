import { auth } from "@/auth";
import { supabaseUser } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionContext = {
  userId: string;
  /** RLS-scoped Supabase client for this EA. */
  db: SupabaseClient;
};

/**
 * Resolve the signed-in EA and an RLS-scoped Supabase client in one call.
 *
 * Returns null when there is no authenticated session or no Supabase access
 * token on it — callers should respond 401. Centralizing this guarantees every
 * user-facing route runs through RLS (via supabaseUser) rather than the
 * service-role client, so tenant isolation is enforced at the database.
 */
export async function sessionContext(): Promise<SessionContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  const accessToken = session?.supabaseAccessToken;
  if (!userId || !accessToken) return null;
  return { userId, db: supabaseUser(accessToken) };
}
