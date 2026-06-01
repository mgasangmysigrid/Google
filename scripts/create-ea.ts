/**
 * Provision an EA (internal user) account.
 *
 * This app has NO public sign-up — EA accounts are created here by an admin
 * using the Supabase service-role key. It creates the Supabase Auth user
 * (email confirmed, so they can sign in immediately) and the matching `users`
 * profile row keyed by the same uuid.
 *
 * Usage:
 *   npx tsx scripts/create-ea.ts <email> <password> ["First" "Last"]
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env
 * (load via `node --env-file=.env.local` or `dotenv`).
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const [email, password, firstName, lastName] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: tsx scripts/create-ea.ts <email> <password> ["First" "Last"]');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Refusing: choose a password of at least 12 characters.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || undefined;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (error || !data.user) {
    console.error("Failed to create auth user:", error?.message ?? "unknown error");
    process.exit(1);
  }

  const { error: profileError } = await admin.from("users").insert({
    id: data.user.id,
    email,
    first_name: firstName ?? null,
    last_name: lastName ?? null,
    role: "user",
  });
  if (profileError) {
    console.error("Auth user created but profile insert failed:", profileError.message);
    console.error("User id:", data.user.id, "— insert the users row manually or re-run.");
    process.exit(1);
  }

  console.log(`Created EA ${email} (id ${data.user.id}).`);
}

main();
