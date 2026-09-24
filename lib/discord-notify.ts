import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { postChannelMessage } from "./discord-api";
import { punchMessage } from "./discord-messages";
import { mapEvent, mapProfile } from "./mappers";
import type { Database } from "./supabase/types";
import type { EventKind } from "./types";

/**
 * Mirror a web-side punch into the employee's Discord admin channel, so the
 * channel stays a complete audit trail whichever surface the punch came from.
 *
 * Never throws and never rejects: a Discord outage must not fail the punch that
 * has already been written to Postgres. Only wired into addEvent() — imports,
 * resets and plan changes stay silent on purpose.
 */
export async function notifyPunch(
  supabase: SupabaseClient<Database>,
  userId: string,
  kind: EventKind,
  ts: number,
  dayKey: string,
): Promise<void> {
  try {
    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .eq("day_key", dayKey)
        .order("ts", { ascending: true }),
    ]);

    // No linked channel yet — the employee's first slash command teaches us one.
    if (!profile?.admin_channel_id) return;

    await postChannelMessage(
      profile.admin_channel_id,
      punchMessage({
        kind,
        ts,
        events: (rows ?? []).map(mapEvent),
        requiredMs: mapProfile(profile).requiredMs,
        name: profile.discord_username || profile.email || "Someone",
      }),
    );
  } catch (err) {
    console.error("[discord] punch notification failed", err);
  }
}
