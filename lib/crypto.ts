// AES-256-GCM encryption for OAuth tokens at rest.
//
// Uses the Web Crypto API (available in both the Node and Edge runtimes) so
// this module can be imported from `auth.ts` without pulling `node:crypto`
// into the Edge middleware bundle. The key is derived from the
// TOKEN_ENCRYPTION_KEY env var via SHA-256, giving a stable 256-bit key from
// any sufficiently random secret.
//
// Stored format: `v1:<iv-base64>:<ciphertext+tag-base64>`. Values that don't
// match this prefix are treated as legacy plaintext and returned as-is, so a
// pre-encryption row keeps working until the next write re-encrypts it.

const PREFIX = "v1";
const ALG = "AES-GCM";
const IV_BYTES = 12;

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "Missing TOKEN_ENCRYPTION_KEY. Set it in .env.local (e.g. `openssl rand -base64 32`).",
    );
  }
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", raw, ALG, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALG, iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const ivB64 = Buffer.from(iv).toString("base64");
  const ctB64 = Buffer.from(new Uint8Array(ciphertext)).toString("base64");
  return `${PREFIX}:${ivB64}:${ctB64}`;
}

export async function decryptToken(payload: string): Promise<string> {
  const parts = payload.split(":");
  // Legacy plaintext (or any non-v1 value) — return unchanged so existing
  // rows keep working through the migration.
  if (parts.length !== 3 || parts[0] !== PREFIX) return payload;

  const key = await getKey();
  const iv = new Uint8Array(Buffer.from(parts[1], "base64"));
  const ciphertext = new Uint8Array(Buffer.from(parts[2], "base64"));
  const plaintext = await crypto.subtle.decrypt(
    { name: ALG, iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}
