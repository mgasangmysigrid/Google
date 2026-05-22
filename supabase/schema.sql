-- MS4-NYLAS consolidated schema (final state of migrations 0001–0005).
-- Run this once in a fresh Supabase project: SQL Editor → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS throughout).

create extension if not exists "pgcrypto";

-- Users. `id` is the app user id (the demo login uses the email as id).
-- Google OAuth tokens are stored encrypted at rest by the app (AES-256-GCM).
create table if not exists users (
  id text primary key,
  email text unique not null,
  first_name text,
  last_name text,
  image_url text,
  role text default 'user',
  google_refresh_token text,
  google_access_token text,
  google_access_token_expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text default 'active',
  primary_contact_name text,
  primary_contact_email text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text default 'active',
  type text default 'main',
  priority text default 'normal',
  assignee_id text references users(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete cascade,
  deadline timestamptz,
  est_effort_minutes int,
  action_date timestamptz,
  notification_at timestamptz,
  created_by text references users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  text text not null,
  done boolean default false,
  position int default 0
);

create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  gmail_thread_id text,
  gmail_message_id text,
  channel text default 'email',
  direction text default 'inbound',
  subject text,
  snippet text,
  from_email text,
  from_name text,
  to_emails text[],
  client_id uuid references clients(id) on delete set null,
  owner_id text references users(id) on delete cascade,
  inbox_status text default 'inbox',
  task_id uuid references tasks(id) on delete set null,
  sent_by text references users(id) on delete set null,
  sent_at timestamptz,
  read_at timestamptz,
  received_at timestamptz default now()
);

do $$ begin
  alter table communications
    add constraint communications_inbox_status_check
    check (inbox_status in ('inbox', 'attached', 'ignored'));
exception when duplicate_object then null;
end $$;

-- Indexes
create index if not exists tasks_assignee_status_idx on tasks (assignee_id, status);
create index if not exists tasks_client_idx on tasks (client_id);
create index if not exists tasks_deadline_idx on tasks (deadline);
create index if not exists tasks_action_date_idx on tasks (action_date);
create index if not exists communications_client_received_idx on communications (client_id, received_at desc);
create index if not exists communications_gmail_thread_idx on communications (gmail_thread_id);
create index if not exists communications_sent_by_idx on communications (sent_by);
create index if not exists communications_direction_idx on communications (direction);
create index if not exists communications_owner_status_idx on communications (owner_id, inbox_status, received_at desc);
create index if not exists communications_task_idx on communications (task_id);
-- Non-partial unique index so upsert(onConflict: 'owner_id,gmail_thread_id') can
-- use it as an arbiter. NULL gmail_thread_id values are distinct in a unique
-- index, so rows without a thread id don't collide.
create unique index if not exists communications_owner_gmail_thread_uidx
  on communications (owner_id, gmail_thread_id);

-- Auto-update tasks.updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- RLS on (service-role-only; the app accesses these tables with the service-role
-- key and enforces per-user access in route handlers — no anon/public access).
alter table users enable row level security;
alter table clients enable row level security;
alter table tasks enable row level security;
alter table task_checklist_items enable row level security;
alter table communications enable row level security;
