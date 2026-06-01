-- 0006: Move from a single shared demo login to per-EA Supabase Auth, re-key
-- users to uuid (matching auth.uid()), and add REAL owner-scoped RLS policies.
--
-- Context: this app is used internally by MySigrid EAs only (clients never get
-- console access). Each EA gets their own Supabase Auth account, provisioned by
-- an admin (no public sign-up). The previous model — one shared
-- DEMO_EMAIL/DEMO_PASSWORD where users.id was the email string — is removed.
--
-- This migration assumes the existing rows are throwaway demo data and does NOT
-- backfill them (the text email ids cannot be mapped to auth uuids). If you have
-- real data to preserve, write a backfill before running this.
--
-- RLS strategy: user-facing tables are now keyed off auth.uid() so the DATABASE
-- enforces tenant isolation even if an app-layer owner filter is ever forgotten.
-- The service-role key (used by token-refresh + account-deletion system paths)
-- still bypasses RLS by design; user-facing reads run as the authenticated user.

begin;

-- ---------------------------------------------------------------------------
-- 1. Drop FK constraints that reference the old text users.id, then drop the
--    dependent user-derived rows. (Throwaway demo data — see header.)
-- ---------------------------------------------------------------------------
truncate table task_checklist_items, communications, tasks, users restart identity cascade;

-- ---------------------------------------------------------------------------
-- 2. Re-key users to uuid that mirrors auth.users(id).
--    users.id IS the Supabase Auth uid, so RLS can compare against auth.uid()
--    directly and a deleted auth user cascades to their app row.
-- ---------------------------------------------------------------------------
alter table users drop constraint if exists users_pkey cascade;
alter table users
  alter column id drop default,
  alter column id set data type uuid using null,
  alter column id set not null;
alter table users add primary key (id);

-- Link app users to Supabase Auth identities. ON DELETE CASCADE: removing the
-- auth user (e.g. offboarding an EA) removes their app profile + (below) data.
alter table users
  add constraint users_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. Convert every user-referencing FK column from text -> uuid.
-- ---------------------------------------------------------------------------
alter table tasks
  alter column assignee_id set data type uuid using null,
  alter column created_by set data type uuid using null;

alter table communications
  alter column owner_id set data type uuid using null,
  alter column sent_by set data type uuid using null;

-- Re-declare the FKs now that the types line up.
alter table tasks
  add constraint tasks_assignee_id_fkey
    foreign key (assignee_id) references users(id) on delete set null,
  add constraint tasks_created_by_fkey
    foreign key (created_by) references users(id) on delete set null;

alter table communications
  add constraint communications_owner_id_fkey
    foreign key (owner_id) references users(id) on delete cascade,
  add constraint communications_sent_by_fkey
    foreign key (sent_by) references users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Row-Level Security policies. RLS is already enabled on these tables
--    (migration 0003 / schema.sql); here we add the actual policies so the
--    `authenticated` role is scoped to its own rows. Without policies the
--    tables were service-role-only; with them, the RLS-respecting client used
--    by user-facing routes can read/write only the caller's data.
-- ---------------------------------------------------------------------------

-- users: an EA can see and update only their own profile.
drop policy if exists users_self_select on users;
create policy users_self_select on users
  for select to authenticated using (id = auth.uid());

drop policy if exists users_self_update on users;
create policy users_self_update on users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- tasks: visible/editable by the EA who is the assignee OR the creator.
drop policy if exists tasks_owner_select on tasks;
create policy tasks_owner_select on tasks
  for select to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid());

drop policy if exists tasks_owner_insert on tasks;
create policy tasks_owner_insert on tasks
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists tasks_owner_update on tasks;
create policy tasks_owner_update on tasks
  for update to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid())
  with check (assignee_id = auth.uid() or created_by = auth.uid());

drop policy if exists tasks_owner_delete on tasks;
create policy tasks_owner_delete on tasks
  for delete to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid());

-- task_checklist_items: access flows through the parent task's ownership.
drop policy if exists checklist_via_task on task_checklist_items;
create policy checklist_via_task on task_checklist_items
  for all to authenticated
  using (
    exists (
      select 1 from tasks t
      where t.id = task_checklist_items.task_id
        and (t.assignee_id = auth.uid() or t.created_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from tasks t
      where t.id = task_checklist_items.task_id
        and (t.assignee_id = auth.uid() or t.created_by = auth.uid())
    )
  );

-- communications: each row is owned by exactly one EA (their mailbox view).
drop policy if exists comms_owner_select on communications;
create policy comms_owner_select on communications
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists comms_owner_insert on communications;
create policy comms_owner_insert on communications
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists comms_owner_update on communications;
create policy comms_owner_update on communications
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists comms_owner_delete on communications;
create policy comms_owner_delete on communications
  for delete to authenticated using (owner_id = auth.uid());

-- clients: the client roster is shared across EAs (internal tool — every EA can
-- see and manage the same client list). Restricted to authenticated users only;
-- never readable anonymously.
drop policy if exists clients_authenticated_all on clients;
create policy clients_authenticated_all on clients
  for all to authenticated using (true) with check (true);

commit;
