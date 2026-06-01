# MS4-NYLAS

A slimmed-down full-stack rebuild of [MS4-Frontend](../MS4-Frontend) on a single Next.js app, using the Google Gmail API directly for email and Supabase for data.

## Features

- **Login / Logout** — Auth.js (NextAuth v5) credentials login backed by **Supabase Auth** (per-EA accounts, no public sign-up). Branded sign-in page.
- **Dashboard** — greeting, stat cards (today, critical, upcoming), critical task list.
- **Tasks** — list + detail with create / edit / close / delete; client + priority + deadline.
- **Communications** — Gmail inbox via a separate "Connect Gmail" OAuth grant flow, send composer.
- **Clients** — searchable list; click-through filters tasks by client.

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4 + Radix UI primitives
- TanStack React Query 5
- Auth.js / NextAuth v5 (credentials provider → Supabase Auth)
- Supabase Postgres with **Row-Level Security** (owner-scoped policies; user-facing routes run as the authenticated EA, system paths use service-role)
- Google Gmail API via `googleapis` (OAuth tokens encrypted at rest, AES-256-GCM)
- Sonner for toasts, Lucide for icons

## Project layout

```
app/
  (auth)/sign-in/[[...sign-in]]      Clerk sign-in
  (app)/                             Protected layout: sidebar + header
    dashboard/                       Greeting + stat cards
    tasks/                           List + [taskId] detail
    communications/                  Nylas inbox + compose
    clients/                         Client list
  api/                               Route handlers (Supabase + Nylas)
    tasks/                           CRUD + close
    clients/                         List + get
    communications/                  Inbox + send + Nylas OAuth
    webhooks/clerk/                  Sync Clerk users → Supabase
components/
  ui/                                Radix wrappers (button, card, etc.)
  layout/                            Sidebar, header
  tasks/                             Task-specific components
  communications/                    Compose dialog
hooks/                               TanStack Query hooks
lib/
  supabase/server.ts                 Service-role server client
  nylas/client.ts                    Nylas v3 client
  api-client.ts                      Browser fetch wrapper
  utils.ts                           cn, getInitials, formatDate
supabase/migrations/0001_init.sql    Schema
supabase/seed.sql                    Optional dev seed
middleware.ts                        Clerk route protection
```

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in:

- **Supabase** — create a project at https://supabase.com/dashboard. Copy:
  - `NEXT_PUBLIC_SUPABASE_URL` — the project URL.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon/public key (used by the RLS-respecting client and for login).
  - `SUPABASE_SERVICE_ROLE_KEY` — the service-role key (server-only; used by token-refresh, account deletion, and the provisioning script). **Never expose this to the browser.**
- **Auth.js** — set `AUTH_SECRET` (`openssl rand -base64 32`) and `AUTH_URL` (e.g. `http://localhost:3000`).
- **Token encryption** — set `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`); OAuth tokens are AES-256-GCM encrypted at rest with a key derived from this.
- **Google** — create an OAuth client. Copy `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. Add `http://localhost:3000/api/communications/google/callback` to the redirect URIs.

### 3. Run the database migration

In the Supabase SQL editor, paste and run [supabase/schema.sql](supabase/schema.sql) (the consolidated final schema, incl. uuid keys + RLS policies). For an existing DB, apply the migrations in order — the auth/RLS changes are in [supabase/migrations/0006_supabase_auth_uuid_rls.sql](supabase/migrations/0006_supabase_auth_uuid_rls.sql).

### 4. Provision EA accounts (no public sign-up)

This is an internal EA-only tool; accounts are created by an admin:

```bash
node --env-file=.env.local node_modules/.bin/tsx scripts/create-ea.ts ea@yourdomain.com "a-strong-password" "First" "Last"
```

(Or create the user in the Supabase Auth dashboard, then add a matching `users` row with the same uuid.)

Optionally seed dev data: edit [supabase/seed.sql](supabase/seed.sql), set `ea_user_id` to a provisioned EA's uuid, then run.

### 5. Start the dev server

```bash
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/sign-in`. Log in with a provisioned EA account.

## Security & CASA Tier 2

This app handles Google **restricted scopes** (`gmail.readonly`, `gmail.send`, `gmail.modify`) and is built to pass a Google CASA Tier 2 assessment. Controls in place:

- **Per-EA authentication** via Supabase Auth (no shared credential, no public sign-up; accounts are admin-provisioned). Passwords are hashed by Supabase (bcrypt).
- **Row-Level Security** — every table has owner-scoped policies keyed off `auth.uid()`. User-facing routes run as the authenticated EA through an RLS-respecting client ([lib/supabase/server.ts](lib/supabase/server.ts) `supabaseUser`), so the database enforces tenant isolation. The service-role key (which bypasses RLS) is confined to token-refresh, account deletion, and provisioning.
- **OAuth tokens encrypted at rest** (AES-256-GCM, [lib/crypto.ts](lib/crypto.ts)).
- **Limited Use data deletion** — disconnect ([/api/communications/google/revoke](app/api/communications/google/revoke/route.ts)) and full account deletion ([/api/account](app/api/account/route.ts)) revoke the Google grant and purge all restricted-scope-derived data.
- **Strict CSP** with a per-request nonce (no `unsafe-inline`/`unsafe-eval` in prod) + HSTS, frame-deny, nosniff ([middleware.ts](middleware.ts), [next.config.ts](next.config.ts)).
- **Email-HTML XSS sanitization** server-side ([lib/sanitize-html.ts](lib/sanitize-html.ts)) plus a sandboxed render iframe.
- **Anti-automation** — rate limiting on login + email send ([lib/rate-limit.ts](lib/rate-limit.ts)), request body-size caps, MIME CRLF guards, Zod validation, generic error messages.

### Before submitting for assessment

- **Put Cloudflare (or equivalent) in front** of the production deployment. It backstops the network-layer DAST checks (TLS, DDoS, edge rate-limiting) and covers the multi-instance gap in the in-memory rate limiter. For a horizontally-scaled deploy, also move `lib/rate-limit.ts` to a shared store (Redis/Upstash).
- **Publish a privacy policy** and link it from the Google OAuth consent screen.
- **Move the OAuth consent screen to "In production"** (a "Testing" app expires restricted-scope refresh tokens every 7 days).
- The assessor (e.g. TAC Security) runs an automated DAST scan and sends a ~54-question SAQ; the controls above map directly to the ASVS items it asks about.

## Branding

Colors, typography, shadows, and dark mode tokens are ported verbatim from MS4-Frontend's `src/index.css` into [app/globals.css](app/globals.css). The brand color is `#547792` (light) / `#213448` (dark).

## What's intentionally not included (vs MS4-Frontend)

- Multi-tenant account-scoped URLs (`/$accountId/...`) — flat routes with `?client_id=` filter
- Twilio SMS/voice, Slack, WhatsApp channels
- Firebase, OneSignal, FullCalendar, ApexCharts, React DnD, TipTap rich text
- Bulk task ops, task cloning, deadline/notes history
- Pinned clients bar, browse-all role-gated dropdown

These can be added later — the data model and component layout match the source closely enough that porting is straightforward.

## Verifying

```bash
npm run lint        # ESLint
npm run type-check  # tsc --noEmit
npm run build       # production build
```
