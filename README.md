# Carryover

A work-hour bank for Figmenta. Every minute over 8 is **credit**, every minute under is **debit** — bank your extra hours and spend them on half-days, late starts, or full days off.

Built with [Next.js 15](https://nextjs.org/) (App Router) + [Tailwind CSS](https://tailwindcss.com/) + [Supabase](https://supabase.com/), and wired into Discord in both directions.

## Features

- **Today** — live timer, break tracking, manual event log, auto-calculated "log out at" target
- **Bank** — balance, credit/debit totals, quick spend suggestions, recent daily deltas
- **History** — 7/14/30-day delta chart and full history table
- **Plan** — month calendar + presets (half-day / late start / leave early / day off / custom)
- **Settings** — policy, phrase editor per event kind, Discord bulk importer, export JSON
- **Auth** — Discord OAuth only. Access = membership of the Figmenta Discord server
- **Discord bridge** — `/in`, `/out`, `/break`, `/resume`, `/status`, `/bank` in your admin channel; web-side punches post back to that channel
- **Data** — Supabase Postgres with RLS, session cookies via `@supabase/ssr`

## Auth model

There is no password and no magic link, and email domain is not checked. You sign
in with Discord; the callback asks Discord which servers you're in and refuses
the session unless the Figmenta guild is one of them.

Consequences, on purpose:

- Interns and contractors on personal Gmail accounts work with no special-casing.
- **Offboarding is a kick from the server.** Membership is re-verified against the
  bot token whenever a session is more than 7 days past its last check, so a
  kicked user loses access without anyone touching the database.
- A second sign-in path would bypass the guild gate, so there isn't one.

`BETA_DISCORD_USER_IDS` narrows this further to a named list while the app is in
private beta — it gates both web sign-in and the slash commands. Leave it unset
in production.

## Timezone

Carryover is IST-only, and IST is a fixed UTC+05:30 with no DST. Every day
boundary in `lib/time.ts` is constant-offset math rather than host-local `Date`
methods, because the app runs on UTC servers and a punch at 23:30 IST must not
land on the previous `day_key`. `npm test` runs with `TZ=UTC` to keep that
honest — don't reintroduce `getFullYear()`/`setHours()` in day-key code.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

Create a project at [supabase.com](https://supabase.com/dashboard), then run both
migrations in the SQL editor, in order:

```
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_discord_identity.sql
```

`0001` creates `profiles`, `events` and `plans` with Row-Level Security. `0002`
adds the Discord identity columns and teaches the signup trigger to capture them.

Then in **Authentication → Providers → Discord**: enable it and paste the OAuth2
**Client ID** and **Client Secret** from the Discord application. Register the
Supabase callback (`https://<project-ref>.supabase.co/auth/v1/callback`) as a
redirect URI on the Discord app — the OAuth handshake lands there, not on this app.

In **Authentication → URL Configuration**, keep `/auth/callback` on the redirect
allow-list for each environment you deploy.

### 3. Create the Discord application

At [discord.com/developers](https://discord.com/developers/applications):

1. **New Application** → note the **Application ID** and **Public Key** (General Information).
2. **Bot** → add a bot, copy the token. Leave privileged intents **off** — the
   bridge is HTTP-only and needs none of them. Turn **Public Bot** off.
3. **OAuth2** → add the Supabase callback URL as a redirect.
4. Invite the bot to the Figmenta server with `bot` + `applications.commands`
   scopes and no server-wide permissions; grant **View Channel** and
   **Send Messages** as a channel overwrite on the admin channels it should reach.
5. **General Information → Interactions Endpoint URL** →
   `https://<your-deploy>/api/discord/interactions`. Discord probes it with
   deliberately invalid signatures before accepting it; the route answers 401 to
   those and `{"type":1}` to a valid PING.

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

See the comments in that file. `SUPABASE_SERVICE_ROLE_KEY` and
`DISCORD_BOT_TOKEN` are secrets — server-side only, never `NEXT_PUBLIC_`.

### 5. Register the slash commands

```bash
npm run register-commands
```

Registers guild commands (instant propagation, invisible outside Figmenta). They
ship hidden from everyone (`default_member_permissions: "0"`); grant them
per-person under **Server Settings → Integrations → Carryover**. For the
full-team rollout, re-run with `COMMANDS_PUBLIC=1`.

Re-run the script after editing the command list — the request replaces the
whole set.

### 6. Run the dev server

```bash
npm run dev
```

Discord can't reach `localhost`, so to exercise the slash commands locally put a
tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) in front and point
the Interactions Endpoint URL at it. The web app and OAuth work without one.

## How the bridge works

**Discord → Carryover.** `app/api/discord/interactions/route.ts` verifies the
Ed25519 signature over `timestamp + rawBody` with `node:crypto`, looks the caller
up by `discord_user_id` with a service-role client, and validates the transition
through `lib/session-guard.ts` — the same state machine the web buttons enforce.
Impossible punches ("you're already clocked in since 12:04") are refused with an
ephemeral reply; valid ones insert an event and confirm publicly, so the channel
keeps its audit-trail role. Replies are synchronous, well inside Discord's 3s
budget.

The first write command also records that channel as the user's
`admin_channel_id`.

**Carryover → Discord.** `addEvent()` in `lib/actions.ts` calls
`lib/discord-notify.ts` after a successful insert, posting the same message
template to `admin_channel_id`. It never throws: a Discord outage must not fail a
punch that's already in Postgres. Only `addEvent` posts — imports, resets and
plan changes stay silent.

There is no always-on process and no gateway bot. Plain-message listening would
need a persistent worker, and is out of scope.

## Project structure

```
app/
  (app)/              Authenticated routes (7-day guild re-verification lives here)
    layout.tsx        Fetches user + state, renders shell
    today/page.tsx
    bank/page.tsx
    history/page.tsx
    plan/page.tsx
    settings/page.tsx
  api/discord/
    interactions/     Slash-command endpoint (Ed25519-verified)
  auth/callback/      OAuth callback + guild gate
  auth/signout/       Clears the session (Server Components can't write cookies)
  login/              Sign in with Discord
  layout.tsx          Root layout (fonts, theme)
  globals.css         Design tokens + component styles
components/           UI components (views + primitives)
lib/
  bank.ts             analyzeSession, calculateBank, dayDelta
  time.ts             IST-fixed day math + formatting
  session-guard.ts    Clock-in state machine, shared by web and Discord
  discord.ts          parseDiscordDump for the bulk importer
  discord-gate.ts     Interaction signature verification + beta allowlist
  discord-api.ts      Discord REST calls (server-only)
  discord-messages.ts Message templates (pure)
  discord-notify.ts   Web punch -> channel post
  mappers.ts          Row -> domain object
  phrases.ts          Default phrase bank per event kind
  actions.ts          Server actions (mutations)
  data.ts             Server-side data fetching
  types.ts            Shared TypeScript types
  supabase/           Browser, server, middleware and service-role clients
middleware.ts         Supabase session refresh + auth guard
scripts/
  register-commands.ts
supabase/migrations/
tests/                vitest, runs under TZ=UTC
```

## Commands

```bash
npm run dev                # start dev server (Turbopack)
npm run build              # production build
npm run start              # start production server
npm run lint               # eslint
npm run type-check         # tsc --noEmit
npm test                   # vitest (TZ=UTC)
npm run register-commands  # push slash commands to the guild
```

## Roles

- Built by [Khush](https://github.com/khushramnani) for Figmenta.
- All timestamps are interpreted in Asia/Kolkata (IST, UTC+5:30).
