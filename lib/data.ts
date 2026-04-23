import { cache } from "react";
import { createClient } from "./supabase/server";
import { sessionsFromEvents, plansFromRows } from "./bank";
import { DEFAULT_PHRASES } from "./phrases";
import type { AppState, EventKind, Plan, WorkEvent } from "./types";
import type { ProfileRow, EventRow, PlanRow } from "./supabase/types";

function mapProfile(row: ProfileRow): AppState["policy"] {
  const rawPhrases = row.phrases as Record<string, string[]> | null;
  const phrases = {
    in: rawPhrases?.in ?? DEFAULT_PHRASES.in,
    out: rawPhrases?.out ?? DEFAULT_PHRASES.out,
    break: rawPhrases?.break ?? DEFAULT_PHRASES.break,
    resume: rawPhrases?.resume ?? DEFAULT_PHRASES.resume,
  };
  return {
    requiredMs: Number(row.required_ms),
    officialStart: row.official_start,
    officialEnd: row.official_end,
    breakCountsAgainst: row.break_counts_against,
    theme: row.theme,
    phrases,
  };
}

function mapEvent(row: EventRow): WorkEvent {
  return {
    id: row.id,
    ts: new Date(row.ts).getTime(),
    kind: row.kind as EventKind,
    raw: row.raw,
  };
}

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    dayKey: row.day_key,
    preset: row.preset,
    presetTitle: row.preset_title,
    costMs: Number(row.cost_ms),
    note: row.note,
    applied: row.applied,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export const getAppState = cache(async (): Promise<AppState | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: events }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("events").select("*").eq("user_id", user.id).order("ts", { ascending: true }),
    supabase.from("plans").select("*").eq("user_id", user.id),
  ]);

  const policy = profile
    ? mapProfile(profile)
    : {
        requiredMs: 8 * 60 * 60 * 1000,
        officialStart: "12:00",
        officialEnd: "20:00",
        breakCountsAgainst: false,
        theme: "dark" as const,
        phrases: DEFAULT_PHRASES,
      };

  const eventObjs = (events ?? []).map(mapEvent);
  const planObjs = (plans ?? []).map(mapPlan);

  return {
    policy,
    sessions: sessionsFromEvents(eventObjs),
    plans: plansFromRows(planObjs),
  };
});

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
