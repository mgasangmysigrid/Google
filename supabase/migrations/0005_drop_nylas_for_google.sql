-- 0005: drop Nylas, use Google Gmail API directly.
--
-- - Move from Nylas grant id to Google OAuth tokens stored per user.
-- - Rename external id columns on communications to make their source explicit.
-- - nylas_events table is no longer needed (no Nylas webhook).

alter table users
  drop column if exists nylas_grant_id,
  add column if not exists google_refresh_token text,
  add column if not exists google_access_token text,
  add column if not exists google_access_token_expires_at timestamptz;

alter table communications
  rename column nylas_thread_id to gmail_thread_id;

alter table communications
  rename column nylas_message_id to gmail_message_id;

-- The unique index and other indexes on the renamed columns are preserved
-- automatically; rename them so the names match.
alter index if exists communications_owner_thread_uidx
  rename to communications_owner_gmail_thread_uidx;
alter index if exists communications_thread_idx
  rename to communications_gmail_thread_idx;

drop table if exists nylas_events;
