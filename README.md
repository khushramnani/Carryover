# Carryover

A work-hour bank for Figmenta. Every minute over 8 is **credit**, every minute under is **debit** — bank your extra hours and spend them on half-days, late starts, or full days off.

Built with [Next.js 15](https://nextjs.org/) (App Router) + [Tailwind CSS](https://tailwindcss.com/) + [Supabase](https://supabase.com/).

## Features

- **Today** — live timer, break tracking, manual event log, auto-calculated "log out at" target
- **Bank** — balance, credit/debit totals, quick spend suggestions, recent daily deltas
- **History** — 7/14/30-day delta chart and full history table
- **Plan** — month calendar + presets (half-day / late start / leave early / day off / custom)
- **Settings** — policy, phrase editor per event kind, Discord bulk importer, export JSON
- **Auth** — email + password or magic link (restricted to `@figmenta.com` domain)
- **Data** — Supabase Postgres with RLS, session cookies via `@supabase/ssr`

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

Create a new project at [supabase.com](https://supabase.com/dashboard), then run the migration in the SQL editor:

```bash
# Paste the contents of supabase/migrations/0001_initial_schema.sql
# into Supabase SQL editor and run it.
```

This creates three tables (`profiles`, `events`, `plans`) with Row-Level Security so each user only sees their own data, plus a trigger that auto-creates a profile row when a user signs up.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Values live in Supabase → Project Settings → API.

### 4. Configure auth redirects

In Supabase → Authentication → URL Configuration:

- **Site URL**: `http://localhost:3000` (dev) / your deploy URL (prod)
- **Redirect URLs**: add `http://localhost:3000/auth/callback` and your deploy equivalent

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be sent to `/login` — sign up with a `@figmenta.com` email.

## Project structure

```
app/
  (app)/              Authenticated routes
    layout.tsx        Fetches user + state, renders shell
    today/page.tsx
    bank/page.tsx
    history/page.tsx
    plan/page.tsx
    settings/page.tsx
  auth/callback/      Magic-link callback
  login/              Sign-in / sign-up
  layout.tsx          Root layout (fonts, theme)
  globals.css         Design tokens + component styles
components/           UI components (views + primitives)
lib/
  bank.ts             analyzeSession, calculateBank, dayDelta
  time.ts             fmt helpers, dayKey, timeOnDay
  discord.ts          parseDiscordDump for the bulk importer
  phrases.ts          Default phrase bank per event kind
  actions.ts          Server actions (mutations)
  data.ts             Server-side data fetching
  types.ts            Shared TypeScript types
  supabase/           Browser, server, middleware clients
middleware.ts         Supabase session refresh + auth guard
supabase/
  migrations/
    0001_initial_schema.sql
```

## Commands

```bash
npm run dev         # start dev server (Turbopack)
npm run build       # production build
npm run start       # start production server
npm run lint        # eslint
npm run type-check  # tsc --noEmit
```

## Roles

- Built by [Khush](https://github.com/khushramnani) for Figmenta.
- All timestamps are interpreted in Asia/Kolkata (IST, UTC+5:30).
