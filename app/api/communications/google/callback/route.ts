import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { encryptToken } from "@/lib/crypto";
import { googleConnectClient } from "@/lib/google/client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const STATE_COOKIE = "g_oauth_state";

/**
 * Complete the "Connect Gmail" flow: validate the state cookie, exchange the
 * authorization code for tokens, and store them (encrypted) against the
 * signed-in user. Redirects back to the Communications page.
 */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/communications?gmail=error", req.url));
  }

  try {
    const { tokens } = await googleConnectClient().getToken(code);

    const update: Record<string, string | null> = {};
    if (tokens.access_token) {
      update.google_access_token = await encryptToken(tokens.access_token);
    }
    if (tokens.refresh_token) {
      update.google_refresh_token = await encryptToken(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      update.google_access_token_expires_at = new Date(
        tokens.expiry_date,
      ).toISOString();
    }

    if (Object.keys(update).length > 0) {
      await supabaseServer().from("users").update(update).eq("id", userId);
    }

    return NextResponse.redirect(
      new URL("/communications?gmail=connected", req.url),
    );
  } catch (err) {
    console.error("gmail connect callback error", err);
    return NextResponse.redirect(new URL("/communications?gmail=error", req.url));
  }
}
