-- 0003: add outbound-email columns to communications and enable RLS.
--
-- All API routes in this app use the Supabase service-role key (see
-- lib/supabase/server.ts), which bypasses RLS. Turning RLS on here without
-- adding permissive authenticated policies means the tables are
-- service-role-only, which is what we want for the Nylas/Google verification
-- demo: no anonymous reads, no client-side writes.

alter table communications
  add column if not exists direction text default 'inbound',
  add column if not exists sent_by text references users(id) on delete set null,
  add column if not exists sent_at timestamptz;

create index if not exists communications_sent_by_idx on communications (sent_by);
create index if not exists communications_direction_idx on communications (direction);

alter table users enable row level security;
alter table clients enable row level security;
alter table tasks enable row level security;
alter table task_checklist_items enable row level security;
alter table communications enable row level security;
