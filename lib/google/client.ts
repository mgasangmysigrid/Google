import { google, type gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

import { decryptToken, encryptToken } from "@/lib/crypto";
import { supabaseServer } from "@/lib/supabase/server";

export class GmailNotConnectedError extends Error {
  constructor(message = "Google account not connected") {
    super(message);
    this.name = "GmailNotConnectedError";
  }
}

// Scopes requested by the standalone "Connect Gmail" flow. Identity is handled
// separately by the credentials login, so these are purely for mailbox access.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

function connectRedirectUri() {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/communications/google/callback`;
}

/**
 * OAuth2 client used to start and complete the "Connect Gmail" consent flow.
 * Configured with the connect callback as its redirect URI.
 */
export function googleConnectClient() {
  return new OAuth2Client(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
    connectRedirectUri(),
  );
}

type StoredTokens = {
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_access_token_expires_at: string | null;
};

async function loadTokens(userId: string): Promise<StoredTokens | null> {
  const { data } = await supabaseServer()
    .from("users")
    .select(
      "google_refresh_token, google_access_token, google_access_token_expires_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  // Tokens are stored encrypted (AES-256-GCM); decrypt for use in memory.
  return {
    google_refresh_token: data.google_refresh_token
      ? await decryptToken(data.google_refresh_token)
      : null,
    google_access_token: data.google_access_token
      ? await decryptToken(data.google_access_token)
      : null,
    google_access_token_expires_at: data.google_access_token_expires_at,
  };
}

function makeOAuthClient(tokens: StoredTokens) {
  const client = new OAuth2Client(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );
  client.setCredentials({
    refresh_token: tokens.google_refresh_token ?? undefined,
    access_token: tokens.google_access_token ?? undefined,
    expiry_date: tokens.google_access_token_expires_at
      ? new Date(tokens.google_access_token_expires_at).getTime()
      : undefined,
  });
  return client;
}

/**
 * Build an authenticated Gmail client for a given user. The OAuth2Client
 * inside `googleapis` refreshes tokens on demand using `refresh_token`; the
 * `tokens` event listener writes the rotated access_token back to Supabase
 * so subsequent requests use the latest value.
 */
export async function getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
  const tokens = await loadTokens(userId);
  if (!tokens?.google_refresh_token) {
    throw new GmailNotConnectedError();
  }

  const oauth2 = makeOAuthClient(tokens);

  oauth2.on("tokens", async (newTokens) => {
    const update: Record<string, string | null> = {};
    if (newTokens.access_token)
      update.google_access_token = await encryptToken(newTokens.access_token);
    if (newTokens.refresh_token)
      update.google_refresh_token = await encryptToken(newTokens.refresh_token);
    if (newTokens.expiry_date) {
      update.google_access_token_expires_at = new Date(
        newTokens.expiry_date,
      ).toISOString();
    }
    if (Object.keys(update).length === 0) return;
    await supabaseServer().from("users").update(update).eq("id", userId);
  });

  return google.gmail({ version: "v1", auth: oauth2 });
}

/**
 * Disconnect a user's Google account: revoke the OAuth token at Google, clear
 * the stored tokens, and delete the Gmail-derived data we cached (the
 * `communications` rows). Per Google's Limited Use / CASA requirements, user
 * data sourced from restricted scopes must not linger after access is revoked.
 */
export async function revokeGoogleAccess(userId: string) {
  const tokens = await loadTokens(userId);
  // loadTokens returns decrypted (plaintext) tokens, which is what Google's
  // revoke endpoint expects.
  const token = tokens?.google_refresh_token ?? tokens?.google_access_token;
  if (token) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
    } catch (err) {
      console.warn("google revoke failed", err);
    }
  }
  const supabase = supabaseServer();
  // Purge cached Gmail content (subjects, snippets, sender/recipient metadata).
  await supabase.from("communications").delete().eq("owner_id", userId);
  await supabase
    .from("users")
    .update({
      google_refresh_token: null,
      google_access_token: null,
      google_access_token_expires_at: null,
    })
    .eq("id", userId);
}
