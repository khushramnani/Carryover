import { DEFAULT_PHRASES } from "./phrases";
import type { EventKind, Plan, Policy, WorkEvent } from "./types";
import type { EventRow, PlanRow, ProfileRow } from "./supabase/types";

// Row -> domain object. Pure, so the Discord interactions route can reuse them
// with a service-role client instead of the cookie-bound one in lib/data.ts.

export function mapProfile(row: ProfileRow): Policy {
  const rawPhrases = row.phrases as Record<string, string[]> | null;
  return {
    requiredMs: Number(row.required_ms),
    officialStart: row.official_start,
    officialEnd: row.official_end,
    breakCountsAgainst: row.break_counts_against,
    theme: row.theme,
    phrases: {
      in: rawPhrases?.in ?? DEFAULT_PHRASES.in,
      out: rawPhrases?.out ?? DEFAULT_PHRASES.out,
      break: rawPhrases?.break ?? DEFAULT_PHRASES.break,
      resume: rawPhrases?.resume ?? DEFAULT_PHRASES.resume,
    },
  };
}

export function mapEvent(row: EventRow): WorkEvent {
  return {
    id: row.id,
    ts: new Date(row.ts).getTime(),
    kind: row.kind as EventKind,
    raw: row.raw,
  };
}

export function mapPlan(row: PlanRow): Plan {
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

export const DEFAULT_POLICY: Policy = {
  requiredMs: 8 * 60 * 60 * 1000,
  officialStart: "12:00",
  officialEnd: "20:00",
  breakCountsAgainst: false,
  theme: "dark",
  phrases: DEFAULT_PHRASES,
};
