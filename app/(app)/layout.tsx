import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAppState, getProfile, getUser } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGuildMember } from "@/lib/discord-api";
import { isBetaAllowed } from "@/lib/discord-gate";
import type { ProfileRow } from "@/lib/supabase/types";

// Events can arrive from Discord without ever passing through this app's
// revalidation, so never serve a cached shell.
export const dynamic = "force-dynamic";

const REVERIFY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Closes the "kicked from the guild but the session cookie still works" hole
 * without paying a Discord round-trip on every request.
 */
async function reverifyGuildMembership(profile: ProfileRow) {
  if (!isBetaAllowed(profile.discord_user_id)) {
    redirect("/auth/signout?error=beta");
  }

  // No Discord identity means this session never passed the guild gate — the
  // callback always writes discord_user_id before it redirects. Supabase's email
  // provider is on by default, so this is a live bypass, not a theoretical one:
  // treat it as "not a member" rather than quietly letting it through.
  if (!profile.discord_user_id) {
    redirect("/auth/signout?error=not-a-member");
  }

  const verifiedAt = profile.guild_member_verified_at
    ? Date.parse(profile.guild_member_verified_at)
    : 0;
  if (Date.now() - verifiedAt < REVERIFY_MS) return;

  const member = await isGuildMember(profile.discord_user_id);
  // null = Discord unreachable or unconfigured. Inconclusive is not "kicked" —
  // an outage must not log the whole company out.
  if (member === null) return;
  if (!member) redirect("/auth/signout?error=not-a-member");

  // Service-role: 0002 revokes UPDATE on this column from `authenticated`, so
  // that a kicked employee can't extend their own verification window.
  await createAdminClient()
    .from("profiles")
    .update({ guild_member_verified_at: new Date().toISOString() })
    .eq("id", profile.id);
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (profile) await reverifyGuildMembership(profile);

  const state = await getAppState();
  if (!state) redirect("/login");

  return (
    <AppShell email={user.email ?? ""} state={state}>
      {children}
    </AppShell>
  );
}
