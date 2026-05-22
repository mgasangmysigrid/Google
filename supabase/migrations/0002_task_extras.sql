-- Adds the extra task columns shown in the MS4-Frontend tasks table layout.
alter table tasks
  add column if not exists est_effort_minutes int,
  add column if not exists action_date timestamptz,
  add column if not exists notification_at timestamptz;

create index if not exists tasks_action_date_idx on tasks (action_date);
