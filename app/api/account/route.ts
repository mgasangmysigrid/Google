import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { revokeGoogleAccess } from "@/lib/google/client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Full account deletion. Revokes the Google grant, purges all data derived from
 * the user's Google account, and removes the user record. Satisfies the
 * "delete your data" requirement of Google's User Data Policy / CASA.
 */
export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Revoke the grant + delete cached Gmail content (communications rows).
  await revokeGoogleAccess(userId);

  const supabase = supabaseServer();
  // Defensive: ensure no Gmail-derived rows remain even if revoke partially ran.
  await supabase.from("communications").delete().eq("owner_id", userId);
  // Remove the user's own tasks (descriptions can contain email snippets).
  await supabase
    .from("tasks")
    .delete()
    .or(`assignee_id.eq.${userId},created_by.eq.${userId}`);
  await supabase.from("users").delete().eq("id", userId);

  return NextResponse.json({ ok: true });
}
