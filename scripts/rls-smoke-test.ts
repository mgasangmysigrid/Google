/**
 * RLS smoke test — proves the database enforces per-EA tenant isolation.
 *
 * Creates two temporary EA users, signs in as each to get their access tokens,
 * then verifies through the RLS-respecting (anon-key + Bearer) client that:
 *   - each EA can read their OWN task
 *   - neither EA can read the OTHER's task (RLS blocks it, even by direct id)
 *   - a forged insert with someone else's owner_id is rejected
 *
 * This is the evidence for the CASA SAQ "how is tenant isolation enforced"
 * question: isolation holds at the DATABASE, not just in app code.
 *
 * Run:
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/rls-smoke-test.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY in the env. The two test users are deleted at the end.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

// An RLS-scoped client carrying a user's access token as the Bearer — exactly
// what lib/supabase/server.ts `supabaseUser` builds for a request.
function asUser(accessToken: string): SupabaseClient {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function provision(email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  await admin.from("users").insert({ id: data.user.id, email, role: "user" });

  // Sign in via the anon client to obtain an access token for RLS calls.
  const anon = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: s, error: se } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (se || !s.session) throw new Error(`signIn ${email}: ${se?.message}`);
  return { id: data.user.id, token: s.session.access_token };
}

async function main() {
  const stamp = "rls-smoke"; // fixed (no Date.now in this env) — cleaned up below
  const aEmail = `${stamp}-a@example.test`;
  const bEmail = `${stamp}-b@example.test`;
  const pw = "smoke-test-pw-123456";

  // Clean up any leftovers from a prior aborted run.
  await cleanup([aEmail, bEmail]);

  console.log("Provisioning two test EAs…");
  const a = await provision(aEmail, pw);
  const b = await provision(bEmail, pw);

  const aDb = asUser(a.token);
  const bDb = asUser(b.token);

  // Each EA creates a task they own.
  const { data: aTask, error: aErr } = await aDb
    .from("tasks")
    .insert({ title: "A's secret task", assignee_id: a.id, created_by: a.id })
    .select()
    .single();
  check("EA-A can create their own task", !aErr && !!aTask, aErr?.message ?? "");

  const { data: bTask, error: bErr } = await bDb
    .from("tasks")
    .insert({ title: "B's secret task", assignee_id: b.id, created_by: b.id })
    .select()
    .single();
  check("EA-B can create their own task", !bErr && !!bTask, bErr?.message ?? "");

  // Each can read their own.
  const { data: aSelf } = await aDb.from("tasks").select("id").eq("id", aTask!.id);
  check("EA-A can read their own task", (aSelf?.length ?? 0) === 1);

  // Neither can read the other's — even asking for it by exact id.
  const { data: aSeesB } = await aDb.from("tasks").select("id").eq("id", bTask!.id);
  check(
    "EA-A CANNOT read EA-B's task (RLS blocks cross-tenant read)",
    (aSeesB?.length ?? 0) === 0,
    `got ${aSeesB?.length} rows`,
  );

  const { data: bSeesA } = await bDb.from("tasks").select("id").eq("id", aTask!.id);
  check(
    "EA-B CANNOT read EA-A's task",
    (bSeesA?.length ?? 0) === 0,
    `got ${bSeesA?.length} rows`,
  );

  // A full unfiltered select returns only the caller's own rows.
  const { data: aAll } = await aDb.from("tasks").select("id");
  check(
    "EA-A's unfiltered task list contains only their own row",
    (aAll?.length ?? 0) === 1 && aAll![0].id === aTask!.id,
    `got ${aAll?.length} rows`,
  );

  // Forged insert: EA-A tries to create a task owned by EA-B — must be rejected
  // by the insert WITH CHECK policy (created_by must equal auth.uid()).
  const { error: forgeErr } = await aDb
    .from("tasks")
    .insert({ title: "forged", assignee_id: b.id, created_by: b.id });
  check(
    "EA-A CANNOT insert a task owned by EA-B (WITH CHECK rejects forgery)",
    !!forgeErr,
    forgeErr ? "" : "insert unexpectedly succeeded",
  );

  console.log("\nCleaning up test users…");
  await cleanup([aEmail, bEmail]);

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

async function cleanup(emails: string[]) {
  // Find auth users by email and delete them; cascade removes their app rows.
  const { data } = await admin.auth.admin.listUsers();
  for (const u of data?.users ?? []) {
    if (u.email && emails.includes(u.email)) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

main().catch((err) => {
  console.error("smoke test crashed:", err);
  process.exit(1);
});
