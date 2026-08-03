/**
 * One-off: register Carryover's slash commands on the Figmenta guild.
 *
 *   npm run register-commands
 *
 * Guild commands (not global) because they propagate instantly and stay
 * invisible outside Figmenta. Re-run after changing this list — the PUT
 * replaces the whole set, so removing an entry here removes the command.
 *
 * During the beta the commands ship with default_member_permissions "0",
 * i.e. nobody can see them until they're granted per-user under
 * Server Settings → Integrations → Carryover.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine — env may come from the shell instead.
}

const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const commands = [
  { name: "in", description: "Clock in — start your work session" },
  { name: "out", description: "Clock out — end your session" },
  { name: "break", description: "Start a break" },
  { name: "resume", description: "Resume after a break" },
  { name: "status", description: "Worked today, current state, log-out target" },
  { name: "bank", description: "Bank balance and your latest daily deltas" },
].map((c) => ({
  ...c,
  type: 1, // CHAT_INPUT
  default_member_permissions: process.env.COMMANDS_PUBLIC === "1" ? null : "0",
}));

async function main() {
  const missing = [
    ["DISCORD_APP_ID", APP_ID],
    ["DISCORD_BOT_TOKEN", BOT_TOKEN],
    ["DISCORD_GUILD_ID", GUILD_ID],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}`);
    process.exit(1);
  }

  const res = await fetch(
    `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    console.error(`Registration failed (${res.status}):\n${text}`);
    process.exit(1);
  }

  const registered = JSON.parse(text) as Array<{ name: string }>;
  console.log(
    `Registered ${registered.length} commands on guild ${GUILD_ID}: ${registered
      .map((c) => `/${c.name}`)
      .join(" ")}`,
  );
  if (process.env.COMMANDS_PUBLIC !== "1") {
    console.log(
      "Hidden from everyone by default (default_member_permissions=0).\n" +
        "Grant access per-user in Server Settings → Integrations → Carryover.\n" +
        "For the full-team rollout re-run with COMMANDS_PUBLIC=1.",
    );
  }
}

main();
