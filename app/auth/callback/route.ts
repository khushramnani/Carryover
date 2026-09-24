import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userGuildIds } from "@/lib/discord-api";
import { isBetaAllowed } from "@/lib/discord-gate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/today";

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const reject = async (reason: string) => {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  };

  const meta = data.user.user_metadata ?? {};
  const discordUserId =
    (typeof meta.provider_id === "string" && meta.provider_id) ||
    (typeof meta.sub === "string" && meta.sub) ||
    data.user.identities?.find((i) => i.provider === "discord")?.id ||
    null;
  const discordUsername =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.preferred_username === "string" && meta.preferred_username) ||
    null;

  if (!discordUserId) return reject("auth");

  // Access gate: membership of the Figmenta guild, not an email domain — that's
  // what makes interns on personal accounts work, and makes offboarding a kick.
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    console.error("[auth] DISCORD_GUILD_ID is not set — refusing to sign anyone in");
    return reject("config");
  }

  const providerToken = data.session.provider_token;
  if (!providerToken) return reject("scope");

  const guilds = await userGuildIds(providerToken);
  if (guilds === null) return reject("discord-unavailable");
  if (!guilds.includes(guildId)) return reject("not-a-member");

  if (!isBetaAllowed(discordUserId)) return reject("beta");

  // Belt-and-braces against the signup trigger: the trigger reads metadata keys
  // that Supabase has renamed before, this reads the verified identity.
  //
  // Service-role, because migration 0002 revokes UPDATE on the identity columns
  // from `authenticated` — they gate offboarding, so their owner must not be
  // able to write them. Scoped to the user we just authenticated.
  const { error: profileError } = await createAdminClient().from("profiles").upsert({
    id: data.user.id,
    email: data.user.email ?? null,
    discord_user_id: discordUserId,
    ...(discordUsername ? { discord_username: discordUsername } : {}),
    guild_member_verified_at: new Date().toISOString(),
  });
  if (profileError) {
    console.error("[auth] profile upsert failed", profileError.message);
    return reject("profile");
  }

  return NextResponse.redirect(`${origin}${next}`);
}
