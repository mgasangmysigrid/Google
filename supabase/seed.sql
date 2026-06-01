-- Optional seed data for local dev.
--
-- tasks.assignee_id references users.id, which is now the Supabase Auth uuid.
-- Provision an EA first (scripts/create-ea.ts) or copy a uuid from the Supabase
-- Auth dashboard, then set :ea_user_id below to that uuid.
--
-- Clients are shared across all EAs, so they need no owner.

\set ea_user_id '00000000-0000-0000-0000-000000000000'

insert into clients (id, name, primary_contact_name, primary_contact_email, status)
values
  ('11111111-1111-1111-1111-111111111111', 'Acme Corp', 'Jane Doe', 'jane@acme.example', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Globex Industries', 'John Smith', 'john@globex.example', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Initech', 'Peter Gibbons', 'peter@initech.example', 'active')
on conflict (id) do nothing;

insert into tasks (title, description, status, priority, assignee_id, created_by, client_id, deadline)
values
  ('Onboard Acme stakeholders', 'Schedule kickoff call and send welcome packet.', 'active', 'high', :'ea_user_id'::uuid, :'ea_user_id'::uuid, '11111111-1111-1111-1111-111111111111', now() + interval '1 day'),
  ('Q2 reporting for Globex', 'Pull metrics and assemble the deck.', 'active', 'normal', :'ea_user_id'::uuid, :'ea_user_id'::uuid, '22222222-2222-2222-2222-222222222222', now() + interval '5 days'),
  ('Review Initech contract', 'Legal review of renewal terms.', 'active', 'high', :'ea_user_id'::uuid, :'ea_user_id'::uuid, '33333333-3333-3333-3333-333333333333', now() + interval '2 days'),
  ('Reply to Acme support thread', 'Customer reported login issue.', 'active', 'high', :'ea_user_id'::uuid, :'ea_user_id'::uuid, '11111111-1111-1111-1111-111111111111', now()),
  ('Plan all-hands agenda', null, 'active', 'normal', :'ea_user_id'::uuid, :'ea_user_id'::uuid, null, now() + interval '7 days');
