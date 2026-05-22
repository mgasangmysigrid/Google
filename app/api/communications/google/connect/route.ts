import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { GMAIL_SCOPES, googleConnectClient } from "@/lib/google/client";

export const runtime = "nodejs";

const STATE_COOKIE = "g_oauth_state";

/**
 * Start the "Connect Gmail" OAuth consent flow. Requires the user to already be
 * signed in (via email/password). Sets a one-time state cookie for CSRF
 * protection, then redirects the browser to Google's consent screen.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const state = crypto.randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const authUrl = googleConnectClient().generateAuthUrl({
    access_type: "offline",
    // Force consent so Google returns a refresh_token on every connect.
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });

  return NextResponse.redirect(authUrl);
}
