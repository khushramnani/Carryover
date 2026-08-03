import "server-only";

// Bot-token / OAuth-token calls against Discord's REST API. Server-only: a
// bot token here is a full-guild credential.

const API = "https://discord.com/api/v10";
const TIMEOUT_MS = 10_000;

function botToken(): string | null {
  return process.env.DISCORD_BOT_TOKEN || null;
}

/** Guild ids the signed-in user belongs to, via their OAuth token. Null on failure. */
export async function userGuildIds(providerToken: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${providerToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[discord] GET /users/@me/guilds -> ${res.status}`);
      return null;
    }
    const guilds = (await res.json()) as Array<{ id: string }>;
    return Array.isArray(guilds) ? guilds.map((g) => g.id) : null;
  } catch (err) {
    console.error("[discord] guild list failed", err);
    return null;
  }
}

/**
 * Is this Discord user still in the guild, per the bot token?
 * `null` means "couldn't tell" (no token configured, Discord down, rate
 * limited) — callers must treat that as inconclusive and NOT sign the user out.
 */
export async function isGuildMember(discordUserId: string): Promise<boolean | null> {
  const token = botToken();
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) return null;
  try {
    const res = await fetch(`${API}/guilds/${guildId}/members/${discordUserId}`, {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) return true;

    if (res.status === 404) {
      // 404 covers two very different things. 10007 Unknown Member means they
      // really were kicked. 10004 Unknown Guild means *we* can't see the guild —
      // wrong DISCORD_GUILD_ID, or the bot was removed, which is exactly what
      // happens while swapping the beta app for the org-owned one. Treating that
      // as "kicked" would sign out the entire company mid-migration.
      const code = await res
        .json()
        .then((b: { code?: number }) => b?.code)
        .catch(() => undefined);
      if (code === 10007) return false;
      console.error(`[discord] guild member check: 404 code=${code} — treating as unknown`);
      return null;
    }

    console.error(`[discord] GET guild member -> ${res.status}`);
    return null;
  } catch (err) {
    console.error("[discord] guild member check failed", err);
    return null;
  }
}

/**
 * Post a plain message to a channel as the bot. Never throws — a Discord
 * outage must not fail the punch that triggered it.
 */
export async function postChannelMessage(
  channelId: string,
  content: string,
): Promise<boolean> {
  const token = botToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        `[discord] POST /channels/${channelId}/messages -> ${res.status} ${await res.text()}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[discord] channel post failed", err);
    return false;
  }
}
