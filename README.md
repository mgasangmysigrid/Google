# MS4-NYLAS

A slimmed-down full-stack rebuild of [MS4-Frontend](../MS4-Frontend) on a single Next.js app, with Nylas for email and Supabase for data.

## Features

- **Login / Logout** — Clerk-hosted auth with branded sign-in page.
- **Dashboard** — greeting, stat cards (today, critical, upcoming), critical task list.
- **Tasks** — list + detail with create / edit / close / delete; client + priority + deadline.
- **Communications** — Nylas v3 inbox, OAuth grant flow, send composer.
- **Clients** — searchable list; click-through filters tasks by client.

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4 + Radix UI primitives
- TanStack React Query 5
- Clerk auth (`@clerk/nextjs`)
- Supabase Postgres (server-side via service-role)
- Nylas v3 SDK (email)
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

- **Clerk** — create an app at https://dashboard.clerk.com. Copy the publishable key + secret. For user sync, create a webhook to `https://YOUR_HOST/api/webhooks/clerk` for `user.created`, `user.updated`, `user.deleted` and copy the signing secret.
- **Supabase** — create a project at https://supabase.com/dashboard. Copy the project URL and the **service role** key (server-only).
- **Nylas** — create an app at https://dashboard-v3.nylas.com. Copy the API key, client ID. Add `http://localhost:3000/api/communications/nylas/callback` to redirect URIs.

### 3. Run the database migration

In the Supabase SQL editor, paste and run [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).

Optionally seed: edit [supabase/seed.sql](supabase/seed.sql), replace the `clerk_user_id` placeholder with your own (visible in the Clerk dashboard or the `users` table after first sign-in), then run.

### 4. Start the dev server

```bash
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/sign-in`.

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
