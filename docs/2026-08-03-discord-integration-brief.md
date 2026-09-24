# Carryover × Discord Integration — Implementation Brief

**Date:** 2026-08-03 (rev 2)
**Author:** Drago (Cowork planning session with Khush)
**Repo:** `C:\Figmenta\carryover`
**Execution:** Claude Code CLI, phase by phase.

**Product framing:** Carryover is a candidate **company-wide** work-hour bank for all Figmenta employees. Current status: prototype Khush is building solo to demo to Federico. Demo/beta phase runs on the **real Figmenta server but scoped to Khush's own admin channel only**, using a throwaway Discord app Khush creates under his own account: bot invited with zero server-wide permissions + a channel overwrite on Khush's admin channel; commands registered with `default_member_permissions: "0"` and restricted to Khush via Server Settings → Integrations; a `BETA_DISCORD_USER_IDS` allowlist guards both the interactions handler and web sign-in. Bot invite requires Manage Server — Khush self-serves if he has it, otherwise it's a one-click ask to Ivan (see `team/HANDOFFS/drago-to-ivan-2026-08-03-carryover-discord-app.md`). Org-owned app + full-team rollout happen only after Federico approves.

**Maestro note:** an existing bot ("Maestro") is already present in the admin channels. Do NOT piggyback Carryover commands on it — slash commands are per-application with a single interactions endpoint, so reusing Maestro would route our interactions through Maestro's backend and couple the systems. Carryover ships its own application. Ownership of Maestro is being confirmed with Ivan for possible long-term consolidation only.

---

## Goal

Turn Carryover from a standalone web tracker into a Discord-native system:

1. **Auth:** replace email/password/magic-link with **Discord OAuth only**. Access gate = membership in the Figmenta Discord server (guild), not email domain. Interns with gmail accounts are covered; offboarding = kick from guild.
2. **Bridge in:** employees run `/in`, `/out`, `/break`, `/resume` slash commands in their Discord admin channel → Carryover records the event.
3. **Bridge out:** actions taken on the Carryover web UI post a message to the employee's admin channel, so channel visibility is preserved either way.

No always-on process. Everything runs as Next.js routes (HTTP interactions endpoint). Plain-message listening (gateway bot) is explicitly OUT of scope for v1 — it needs a persistent worker (Ivan infra).

---

## Phase 0 — Timezone hardening (PREREQUISITE, ship first, no dependencies)

**Why:** `lib/time.ts` `dayKey()`, `timeOnDay()`, `startOfDay()`, `addDays()` and `lib/bank.ts` `sessionsFromEvents()` use local `Date` methods. On the user's laptop (IST) they're correct; in a serverless deploy (UTC) and in the interactions route, a punch at 23:30 IST lands on the wrong `day_key`. The bot makes this bug live, so it must die first.

**Approach:** IST is fixed UTC+05:30, no DST — use constant-offset math, no library needed.

```ts
// lib/time.ts
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function dayKey(ts: number | Date): string {
  const t = (typeof ts === "number" ? ts : ts.getTime()) + IST_OFFSET_MS;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
```

- Rewrite `startOfDay`, `addDays`, `timeOnDay` the same way (shift into IST, use UTC accessors, shift back).
- `lib/bank.ts` `sessionsFromEvents()` currently re-derives the day with local `getFullYear()` etc. — replace with a call to the fixed `dayKey()`.
- `lib/discord.ts` `parseDiscordHeader` constructs `new Date(y, m, d, H, mi)` in server-local time — same treatment (interpret parsed wall-clock as IST).
- `components/plan-view.tsx` builds the calendar from local `Date` — acceptable for v1 (renders in the user's browser, all users are IST), but leave a `// TZ:` comment.

**Tests (add first — repo has none):** set up `vitest`; unit-test `dayKey` around the midnight boundary with `TZ=UTC` forced in the test env (`23:59 IST`, `00:01 IST`, and a UTC timestamp of `18:31Z` must map to the *next* IST day). Test `analyzeSession` and `calculateBank` while at it — they're pure functions and the core of the product.

**Acceptance:** `TZ=UTC npm test` green; `npm run type-check` green.

---

## Phase 1 — Discord OAuth + guild gate (replaces email auth)

### 1.1 Supabase config (dashboard, manual — Khush)

- Auth → Providers → **Discord**: enable; paste OAuth2 **Client ID** + **Client Secret** (from Ivan's handoff).
- The Supabase callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) must be registered as a redirect URI on the Discord app — included in the Ivan handoff.
- Keep Site URL / redirect allow-list as-is (already configured for `/auth/callback`).

### 1.2 Schema — `supabase/migrations/0002_discord_identity.sql`

```sql
alter table public.profiles
  add column if not exists discord_user_id text unique,
  add column if not exists discord_username text,
  add column if not exists admin_channel_id text,
  add column if not exists guild_member_verified_at timestamptz;

create index if not exists profiles_discord_uid_idx on public.profiles (discord_user_id);
```

Update `handle_new_user()` to also capture Discord identity on signup:

```sql
insert into public.profiles (id, email, discord_user_id, discord_username)
values (
  new.id,
  new.email,
  new.raw_user_meta_data->>'provider_id',
  coalesce(new.raw_user_meta_data->>'custom_claims'->>'global_name',
           new.raw_user_meta_data->>'full_name')
)
on conflict (id) do nothing;
```

> CLI note: verify the exact metadata keys Supabase's Discord provider writes (`provider_id`, `sub`, `full_name`, `avatar_url`) by inspecting `auth.users.raw_user_meta_data` after the first real sign-in on a dev project, and adjust. Do not guess — check.

### 1.3 Login flow

- `components/auth-form.tsx`: gut it. Single **"Continue with Discord"** button →
  ```ts
  supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: `${location.origin}/auth/callback`,
      scopes: "identify email guilds",
    },
  });
  ```
  Delete: password mode, magic-link mode, sign-up toggle, `ALLOWED_DOMAINS`, all related state. Keep the marketing left panel.
- Keep the auth page copy honest: "Sign in with the Discord account you use on the Figmenta server."

### 1.4 Guild gate — server-side, in `app/auth/callback/route.ts`

After `exchangeCodeForSession`:

1. Read `provider_token` from the returned session.
2. `GET https://discord.com/api/users/@me/guilds` with `Authorization: Bearer <provider_token>`.
3. If `DISCORD_GUILD_ID` **not** in the list → `supabase.auth.signOut()`, redirect to `/login?error=not-a-member`, render a friendly "Ask an admin to add you to the Figmenta server" message.
4. **Beta gate:** if `BETA_DISCORD_USER_IDS` is set and this Discord user ID isn't on it → sign out, redirect `/login?error=beta` ("Carryover is in private beta").
5. If member (and beta-allowed) → update own profile row: `discord_user_id` (from user identity, as belt-and-braces vs the trigger), `guild_member_verified_at = now()`; redirect `/today`.

Belt-and-braces re-verification: in the `(app)/layout.tsx` data path, if `guild_member_verified_at` is older than **7 days**, re-check via the **bot token** (`GET /guilds/{DISCORD_GUILD_ID}/members/{discord_user_id}`, 404 ⇒ kicked) and either refresh the timestamp or sign out. This closes the "kicked but session still valid" hole without hitting Discord on every request.

### 1.5 Cleanup

- Existing email accounts: dev-stage data — wipe `auth.users` and let people re-sign-up via Discord. No dual-path auth; a second path bypasses the guild gate.
- README: rewrite auth section.

**Acceptance:** non-guild Discord account is rejected server-side; guild member lands on /today with `discord_user_id` populated; no password/magic-link code remains; middleware still guards all routes.

---

## Phase 2 — Slash-command bridge (Discord → Carryover)

### 2.1 Command registration — `scripts/register-commands.ts`

One-off script (run via `npx tsx`, uses `DISCORD_BOT_TOKEN` + `DISCORD_APP_ID` + `DISCORD_GUILD_ID`). Register **guild** commands (instant propagation, and invisible outside Figmenta):

| Command   | Description                          |
|-----------|--------------------------------------|
| `/in`     | Clock in — start your work session   |
| `/out`    | Clock out — end your session         |
| `/break`  | Start a break                        |
| `/resume` | Resume after a break                 |
| `/status` | (read) Worked today, state, log-out-at target — ephemeral |
| `/bank`   | (read) Bank balance + last deltas — ephemeral |

Keep names short — muscle memory beats `/loggingin`. Descriptions can carry the long phrasing.

### 2.2 Interactions endpoint — `app/api/discord/interactions/route.ts`

- `POST` handler; **must** verify Ed25519 signature (`x-signature-ed25519`, `x-signature-timestamp`) against `DISCORD_PUBLIC_KEY` using the `discord-interactions` npm package (`verifyKey`) before parsing. Return 401 on failure. Discord actively probes with bad signatures at endpoint-save time — this is not optional.
- Handle `PING` (type 1) → `PONG` (type 1). This is Discord's endpoint validation.
- Route must read the **raw body** for verification (get text first, verify, then `JSON.parse`). Ensure the route is `export const dynamic = "force-dynamic"` and not edge-cached.
- 3-second response budget: the insert path is one indexed lookup + one insert — respond **synchronously** with type 4 (`CHANNEL_MESSAGE_WITH_SOURCE`). No deferred-response machinery in v1.

### 2.3 Handler logic (per command)

0. **Beta gate:** if `BETA_DISCORD_USER_IDS` is set and the invoker isn't on it → ephemeral "Carryover is in private beta." Stop.
1. Extract `member.user.id` (guild interaction) → look up `profiles` by `discord_user_id` using a **service-role** Supabase client (new `lib/supabase/admin.ts`; `SUPABASE_SERVICE_ROLE_KEY`, server-only, never imported by client components — add an `import "server-only"` guard).
2. No profile → ephemeral reply: "You haven't signed in to Carryover yet → <app URL>. Sign in with Discord once and you're linked."
3. Load today's events (`user_id + day_key` — Phase 0's IST `dayKey(Date.now())`), run `analyzeSession`, validate the transition exactly as `today-view.tsx` does (`canLogIn`/`canBreak`/`canResume`/`canLogOut`). Invalid → **ephemeral** error ("You're already clocked in since 12:04", "You're not clocked in", …). This validation is a hard requirement — free-text Discord never had it, it's half the point of the bridge.
4. Valid → insert event (`kind`, `ts = now ISO`, `day_key`, `raw = '/in via discord'`).
5. **Admin-channel learning:** if `profiles.admin_channel_id` is null, set it to `channel_id` of this interaction (first write-command wins; editable later in an admin view).
6. Public (non-ephemeral) confirmation so the channel keeps its audit-trail role, reusing today-view's banner logic:
   - `/in` → "🟢 **Khush** clocked in at 12:04 IST — log out at 20:04"
   - `/break` → "⏸️ Break started at 15:30 IST"
   - `/resume` → "▶️ Back at 15:47 IST — 17m break"
   - `/out` → "🔴 Clocked out at 20:31 IST — worked 8h 10m (**+10m** banked)"
   - `/status`, `/bank` → ephemeral.
7. Factor the transition-validation into `lib/session-guard.ts` shared by the route and (optionally, later) the web actions.

**Note on revalidation:** events written by the bot don't call `revalidatePath` in the web app's context. The Today view already re-renders every second client-side, but the server payload is what carries events — acceptable staleness is "next navigation/refresh". v1: add `export const revalidate = 0`/`dynamic = "force-dynamic"` on the `(app)` layout data path if not already effective, and move on. Realtime subscription is a later polish item.

### 2.4 Env vars (`.env.local.example` update)

```
DISCORD_APP_ID=
DISCORD_PUBLIC_KEY=
DISCORD_BOT_TOKEN=           # secret — server only
DISCORD_GUILD_ID=            # real Figmenta guild ID (beta + prod)
BETA_DISCORD_USER_IDS=       # comma-separated; beta gate for commands + web sign-in; empty/unset = gate off (prod)
SUPABASE_SERVICE_ROLE_KEY=   # secret — server only
```

**Acceptance:** endpoint passes Discord's signature validation on save; all four write commands enforce the state machine; unknown Discord user gets onboarding nudge; events appear in web UI with correct IST `day_key`; `/status` and `/bank` figures match the web views.

---

## Phase 3 — Web → Discord posting (Carryover → channel)

In `lib/actions.ts` `addEvent()` (and only there — imports, resets, plan changes do NOT post):

- After a successful insert, if the profile has `admin_channel_id`, fire `POST https://discord.com/api/channels/{admin_channel_id}/messages` with the bot token, same message templates as 2.3.6. Wrap in try/catch — **a Discord failure must never fail the punch**; log and continue.
- New `lib/discord-notify.ts` for the REST call (10s timeout, no retries in v1).
- No echo risk: ingestion is slash-command-only; bot-authored messages are plain messages, never interactions.

**Acceptance:** web "Log in" click produces both the DB event and the channel message; Discord being down doesn't break the web action.

---

## Rollout order & gates

| Step | What | Gate |
|------|------|------|
| 0 | Phase 0 TZ fix + test setup | tests green under `TZ=UTC` |
| 1 | **Beta setup:** Khush creates throwaway Discord app on his own account; bot invited to the **Figmenta server** with zero global perms + channel overwrite on Khush's admin channel (self-serve if Khush has Manage Server, else one-click ask to Ivan); `DISCORD_GUILD_ID` = real Figmenta guild; commands `default_member_permissions: "0"` + Integrations-restricted to Khush; staging/dev Supabase project | credentials in `.env.local`; no other employee can see the commands |
| 2 | Phase 1 auth swap on the dev project + preview deploy, `BETA_DISCORD_USER_IDS` gate active | Khush's account in; a guild member NOT on the beta list politely rejected; a non-guild account rejected |
| 3 | Phase 2 bridge, live in Khush's admin channel | commands E2E; non-beta invoker gets ephemeral "private beta" reply |
| 4 | Phase 3 outbound | E2E both directions — **demo ready for Federico** |
| 5 | **Federico approval** (demo from the real channel — strongest possible demo) | approved |
| 6 | Ivan handoff fulfilled: org-owned app, tokens via HANDOFFS, bot invited with access to ALL admin channels | credentials in hand |
| 7 | Prod: remove beta app + beta allowlist, flip Supabase prod provider config, swap env to org app, register commands unrestricted on Figmenta guild, set interactions endpoint URL, announce to team | — |

> Step 6/7 note: the org app is a **different application** (new IDs/keys) — commands must be re-registered and the interactions endpoint re-set; code is unchanged, only env vars swap.

Costs: zero new spend. Discord bot/app is free; everything runs inside existing Supabase + hosting.

Out of scope for v1 (explicitly): manager/CEO dashboards & roles, plain-message gateway listening, realtime UI subscriptions, Notion/leave-type integrations.

---

## File-touch map (for the CLI session)

```
lib/time.ts                          rewrite core helpers IST-fixed (P0)
lib/bank.ts                          sessionsFromEvents → use dayKey (P0)
lib/discord.ts                       parseDiscordHeader IST interpretation (P0)
tests/*                              new: vitest + unit tests (P0)
components/auth-form.tsx             gut → single Discord button (P1)
app/auth/callback/route.ts           guild gate (P1)
app/login/page.tsx                   error-state rendering (P1)
supabase/migrations/0002_*.sql       discord identity columns + trigger (P1)
app/(app)/layout.tsx                 7-day re-verify hook (P1)
scripts/register-commands.ts         new (P2)
app/api/discord/interactions/route.ts new (P2)
lib/supabase/admin.ts                new service-role client (P2)
lib/session-guard.ts                 new shared transition validation (P2)
lib/discord-notify.ts                new outbound post (P3)
lib/actions.ts                       addEvent → notify (P3)
.env.local.example / README.md       update (all)
```
