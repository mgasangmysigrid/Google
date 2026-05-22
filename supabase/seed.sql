-- Optional seed data for local dev.
-- Note: tasks reference users.id (Clerk id). Sign in once first so your user
-- row exists via the Clerk webhook, then update :clerk_user_id below.

\set clerk_user_id 'user_REPLACE_WITH_YOUR_CLERK_ID'

insert into clients (id, name, primary_contact_name, primary_contact_email, status)
values
  ('11111111-1111-1111-1111-111111111111', 'Acme Corp', 'Jane Doe', 'jane@acme.example', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Globex Industries', 'John Smith', 'john@globex.example', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Initech', 'Peter Gibbons', 'peter@initech.example', 'active')
on conflict (id) do nothing;

insert into tasks (title, description, status, priority, assignee_id, client_id, deadline)
values
  ('Onboard Acme stakeholders', 'Schedule kickoff call and send welcome packet.', 'active', 'high', :'clerk_user_id', '11111111-1111-1111-1111-111111111111', now() + interval '1 day'),
  ('Q2 reporting for Globex', 'Pull metrics and assemble the deck.', 'active', 'normal', :'clerk_user_id', '22222222-2222-2222-2222-222222222222', now() + interval '5 days'),
  ('Review Initech contract', 'Legal review of renewal terms.', 'active', 'high', :'clerk_user_id', '33333333-3333-3333-3333-333333333333', now() + interval '2 days'),
  ('Reply to Acme support thread', 'Customer reported login issue.', 'active', 'high', :'clerk_user_id', '11111111-1111-1111-1111-111111111111', now()),
  ('Plan all-hands agenda', null, 'active', 'normal', :'clerk_user_id', null, now() + interval '7 days');
