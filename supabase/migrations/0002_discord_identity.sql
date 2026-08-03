-- Carryover: Discord identity on profiles.
-- Auth moves from email/password to Discord OAuth; access is gated on
-- membership of the Figmenta guild, so we need the Discord user id on the
-- profile to (a) re-verify membership and (b) route slash commands.

alter table public.profiles
  add column if not exists discord_user_id text unique,
  add column if not exists discord_username text,
  add column if not exists admin_channel_id text,
  add column if not exists guild_member_verified_at timestamptz;

-- ============================================================
-- Lock the identity columns away from the user who owns the row.
--
-- The owner-write policy from 0001 is row-scoped, not column-scoped:
-- `for all using (auth.uid() = id)`. Without the grants below, a kicked
-- employee could PATCH their own guild_member_verified_at into the future with
-- nothing but the public anon key and their existing session, and the 7-day
-- re-verification in app/(app)/layout.tsx would never call Discord again.
-- Offboarding is "kick from the guild", so these four columns are the gate.
--
-- Table-level UPDATE implies every column, so it has to be revoked wholesale
-- and re-granted per column. The two legitimate identity writers
-- (app/auth/callback/route.ts and the layout re-verify) use the service-role
-- client, which is unaffected by these grants.
-- ============================================================
revoke update on public.profiles from authenticated;
grant update (
  id, required_ms, official_start, official_end,
  break_counts_against, theme, phrases
) on public.profiles to authenticated;

-- Slash commands look a profile up by Discord id on every invocation.
-- (The unique constraint above already creates an index; this is belt-and-braces
-- and harmless — Postgres keeps both, at the cost of one small index.)
create index if not exists profiles_discord_uid_idx on public.profiles (discord_user_id);

-- ============================================================
-- Capture the Discord identity at signup.
--
-- Supabase's Discord provider writes provider_id / sub (the Discord snowflake)
-- and full_name / name / preferred_username into raw_user_meta_data. The keys
-- have moved between Supabase releases, hence the coalesce chain; the auth
-- callback also writes discord_user_id belt-and-braces, so a metadata rename
-- degrades to "username missing", never to "identity missing".
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, discord_user_id, discord_username)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'provider_id',
      new.raw_user_meta_data->>'sub'
    ),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'preferred_username',
      new.raw_user_meta_data->'custom_claims'->>'global_name'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
