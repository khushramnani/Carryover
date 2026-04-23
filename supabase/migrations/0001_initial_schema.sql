-- Carryover: initial schema
-- Run this in the Supabase SQL editor (or via the Supabase CLI) after creating the project.

-- ============================================================
-- profiles: per-user policy / settings (1:1 with auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  required_ms bigint not null default 28800000, -- 8 hours in ms
  official_start text not null default '12:00',
  official_end text not null default '20:00',
  break_counts_against boolean not null default false,
  theme text not null default 'dark' check (theme in ('dark','light')),
  phrases jsonb not null default '{
    "in":["logging in","logged in","clocking in","starting work","starting day","start of day"],
    "out":["logging out","logged out","clocking out","signing off","wrapping up","done for today","end of day","ending day"],
    "break":["taking a break","on break","starting break","going on break","brb","afk","lunch","stepping out","stepping away"],
    "resume":["im back","i''m back","back","resuming","resumed","returning","returned","end of break"]
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: owner read" on public.profiles;
create policy "profiles: owner read" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: owner write" on public.profiles;
create policy "profiles: owner write" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
-- events: every clock-in / break / resume / clock-out punch
-- ============================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null,
  kind text not null check (kind in ('in','out','break','resume')),
  ts timestamptz not null,
  raw text,
  created_at timestamptz not null default now()
);

create index if not exists events_user_day_idx on public.events (user_id, day_key);
create index if not exists events_user_ts_idx on public.events (user_id, ts);

alter table public.events enable row level security;

drop policy if exists "events: owner read" on public.events;
create policy "events: owner read" on public.events
  for select using (auth.uid() = user_id);

drop policy if exists "events: owner write" on public.events;
create policy "events: owner write" on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- plans: spending banked hours on future days (half-day, late start, etc.)
-- ============================================================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null,
  preset text not null,
  preset_title text not null,
  cost_ms bigint not null,
  note text,
  applied boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, day_key)
);

create index if not exists plans_user_idx on public.plans (user_id, day_key);

alter table public.plans enable row level security;

drop policy if exists "plans: owner read" on public.plans;
create policy "plans: owner read" on public.plans
  for select using (auth.uid() = user_id);

drop policy if exists "plans: owner write" on public.plans;
create policy "plans: owner write" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- trigger: auto-create a profile row when a new user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- touch updated_at
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
