-- MS4-NYLAS initial schema
-- Run this once in your Supabase SQL editor or via supabase db push.

create extension if not exists "pgcrypto";

create table if not exists users (
  id text primary key,
  email text unique not null,
  first_name text,
  last_name text,
  image_url text,
  role text default 'user',
  nylas_grant_id text,
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
  nylas_thread_id text,
  nylas_message_id text,
  channel text default 'email',
  subject text,
  snippet text,
  from_email text,
  from_name text,
  to_emails text[],
  client_id uuid references clients(id) on delete set null,
  read_at timestamptz,
  received_at timestamptz default now()
);

create index if not exists tasks_assignee_status_idx on tasks (assignee_id, status);
create index if not exists tasks_client_idx on tasks (client_id);
create index if not exists tasks_deadline_idx on tasks (deadline);
create index if not exists communications_client_received_idx on communications (client_id, received_at desc);
create index if not exists communications_thread_idx on communications (nylas_thread_id);

-- Auto-update updated_at on tasks
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
