-- 0004: inbox state + webhook idempotency
--
-- - `communications.owner_id` scopes a row to the user whose inbox it appeared in
--   (separate from `sent_by`, which is only set on outbound).
-- - `inbox_status` powers the Inbox / Attached / Ignored tabs.
-- - `task_id` links an attached thread to a task.
-- - Unique `(owner_id, nylas_thread_id)` enables upserts on list-fetch.
-- - `nylas_events` is the idempotency table for the webhook receiver.

alter table communications
  add column if not exists owner_id text references users(id) on delete cascade,
  add column if not exists inbox_status text default 'inbox',
  add column if not exists task_id uuid references tasks(id) on delete set null;

do $$ begin
  alter table communications
    add constraint communications_inbox_status_check
    check (inbox_status in ('inbox', 'attached', 'ignored'));
exception when duplicate_object then null;
end $$;

create unique index if not exists communications_owner_thread_uidx
  on communications (owner_id, nylas_thread_id)
  where nylas_thread_id is not null;

create index if not exists communications_owner_status_idx
  on communications (owner_id, inbox_status, received_at desc);

create index if not exists communications_task_idx on communications (task_id);

create table if not exists nylas_events (
  id text primary key,
  type text,
  processed_at timestamptz default now()
);

alter table nylas_events enable row level security;
