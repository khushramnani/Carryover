import { sessionsFromEvents, plansFromRows } from "@/lib/bank";
import { bankMessage, punchMessage, statusMessage } from "@/lib/discord-messages";
import { isBetaAllowed, verifyDiscordSignature } from "@/lib/discord-gate";
import { DEFAULT_POLICY, mapEvent, mapPlan, mapProfile } from "@/lib/mappers";
import { checkTransition } from "@/lib/session-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayKey } from "@/lib/time";
import type { EventKind, WorkEvent } from "@/lib/types";

// Signature verification needs node:crypto, and the response must never be
// cached — Discord POSTs a fresh signed body every time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EPHEMERAL = 64;

const WRITE_COMMANDS: Record<string, EventKind> = {
  in: "in",
  out: "out",
  break: "break",
  resume: "resume",
};

function reply(content: string, ephemeral = true) {
  return Response.json({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      content,
      flags: ephemeral ? EPHEMERAL : 0,
      allowed_mentions: { parse: [] },
    },
  });
}

export async function POST(request: Request) {
  // Read the raw body first: the signature covers the exact bytes Discord sent,
  // so re-serialising parsed JSON would break verification.
  const raw = await request.text();

  if (
    !verifyDiscordSignature(
      raw,
      request.headers.get("x-signature-ed25519"),
      request.headers.get("x-signature-timestamp"),
      process.env.DISCORD_PUBLIC_KEY,
    )
  ) {
    // Discord probes with deliberately invalid signatures when you save the
    // endpoint URL and refuses it unless these come back 401.
    return new Response("invalid request signature", { status: 401 });
  }

  let body: DiscordInteraction;
  try {
    body = JSON.parse(raw) as DiscordInteraction;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (body.type === 1) return Response.json({ type: 1 }); // PING -> PONG
  if (body.type !== 2) return reply("Carryover doesn't handle that interaction.");

  try {
    return await handleCommand(body, request);
  } catch (err) {
    console.error("[discord] interaction failed", err);
    return reply("Carryover hit an error recording that. Try again in a moment.");
  }
}

async function handleCommand(body: DiscordInteraction, request: Request) {
  const discordUserId = body.member?.user?.id ?? body.user?.id ?? null;
  if (!discordUserId) return reply("Couldn't tell who you are on Discord.");

  if (!isBetaAllowed(discordUserId)) {
    return reply("Carryover is in private beta.");
  }

  const command = body.data?.name ?? "";
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  if (!profile) {
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    return reply(
      `You haven't signed in to Carryover yet → ${appUrl}\nSign in with Discord once and this channel is linked to you for good.`,
    );
  }

  const policy = mapProfile(profile);
  const displayName =
    body.member?.nick ||
    body.member?.user?.global_name ||
    body.member?.user?.username ||
    profile.discord_username ||
    "Someone";

  if (command === "bank") {
    const [
      { data: events, error: eventsErr },
      { data: plans, error: plansErr },
    ] = await Promise.all([
      admin.from("events").select("*").eq("user_id", profile.id).order("ts", { ascending: true }),
      admin.from("plans").select("*").eq("user_id", profile.id),
    ]);
    // A failed read must not render as a confident "your bank is empty".
    if (eventsErr) throw new Error(eventsErr.message);
    if (plansErr) throw new Error(plansErr.message);
    return reply(
      bankMessage({
        policy,
        sessions: sessionsFromEvents((events ?? []).map(mapEvent)),
        plans: plansFromRows((plans ?? []).map(mapPlan)),
      }),
    );
  }

  const now = Date.now();
  const todayKey = dayKey(now);
  const { data: rows, error: eventsError } = await admin
    .from("events")
    .select("*")
    .eq("user_id", profile.id)
    .eq("day_key", todayKey)
    .order("ts", { ascending: true });
  if (eventsError) throw new Error(eventsError.message);

  const today: WorkEvent[] = (rows ?? []).map(mapEvent);

  if (command === "status") {
    return reply(statusMessage(today, policy, now));
  }

  const kind = WRITE_COMMANDS[command];
  if (!kind) return reply(`Unknown command \`/${command}\`.`);

  // Same state machine the web buttons enforce — this is what free-text
  // Discord never had.
  const guard = checkTransition(today, kind, now);
  if (!guard.ok) return reply(guard.reason);

  const { error: insertError } = await admin.from("events").insert({
    user_id: profile.id,
    kind,
    ts: new Date(now).toISOString(),
    day_key: todayKey,
    raw: `/${kind} via discord`,
  });
  if (insertError) throw new Error(insertError.message);

  // First write command teaches us where this person's admin channel is, so
  // web-side punches can post back to it.
  if (!profile.admin_channel_id && body.channel_id) {
    const { error } = await admin
      .from("profiles")
      .update({ admin_channel_id: body.channel_id })
      .eq("id", profile.id);
    if (error) console.error("[discord] admin_channel_id learn failed", error.message);
  }

  // Public on purpose: the channel keeps its audit-trail role.
  return reply(
    punchMessage({
      kind,
      ts: now,
      events: [...today, { id: "pending", ts: now, kind }],
      requiredMs: policy.requiredMs || DEFAULT_POLICY.requiredMs,
      name: displayName,
    }),
    false,
  );
}

interface DiscordInteraction {
  type: number;
  channel_id?: string;
  data?: { name?: string };
  member?: {
    nick?: string | null;
    user?: { id: string; username?: string; global_name?: string | null };
  };
  user?: { id: string; username?: string; global_name?: string | null };
}
