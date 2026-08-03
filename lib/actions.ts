"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { notifyPunch } from "./discord-notify";
import { dayKey as dk } from "./time";
import type { EventKind, Plan, Policy } from "./types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function addEvent(kind: EventKind) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const dayKey = dk(now);
  const { error } = await supabase.from("events").insert({
    user_id: user.id,
    kind,
    ts: new Date(now).toISOString(),
    day_key: dayKey,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");

  await notifyPunch(supabase, user.id, kind, now, dayKey);
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("events").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function resetDay(dayKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("user_id", user.id)
    .eq("day_key", dayKey);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function updatePolicy(patch: Partial<Policy>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const row: Record<string, unknown> = {};
  if (patch.requiredMs !== undefined) row.required_ms = patch.requiredMs;
  if (patch.officialStart !== undefined) row.official_start = patch.officialStart;
  if (patch.officialEnd !== undefined) row.official_end = patch.officialEnd;
  if (patch.breakCountsAgainst !== undefined) row.break_counts_against = patch.breakCountsAgainst;
  if (patch.theme !== undefined) row.theme = patch.theme;
  if (patch.phrases !== undefined) row.phrases = patch.phrases;

  const { error } = await supabase.from("profiles").upsert({ id: user.id, ...row });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function applyPlan(
  dayKey: string,
  plan: Omit<Plan, "id" | "createdAt" | "dayKey">,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("plans").upsert(
    {
      user_id: user.id,
      day_key: dayKey,
      preset: plan.preset,
      preset_title: plan.presetTitle,
      cost_ms: plan.costMs,
      note: plan.note,
      applied: plan.applied,
    },
    { onConflict: "user_id,day_key" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function removePlan(dayKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("plans")
    .delete()
    .eq("user_id", user.id)
    .eq("day_key", dayKey);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export interface ImportEventInput {
  kind: EventKind;
  ts: number;
  raw?: string | null;
}

export async function importEvents(
  rowsByDay: Record<string, ImportEventInput[]>,
  mode: "replace" | "merge",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const days = Object.keys(rowsByDay);
  if (days.length === 0) return;

  if (mode === "replace") {
    const { error: delErr } = await supabase
      .from("events")
      .delete()
      .eq("user_id", user.id)
      .in("day_key", days);
    if (delErr) throw new Error(delErr.message);
  }

  const toInsert: Array<{
    user_id: string;
    day_key: string;
    kind: EventKind;
    ts: string;
    raw: string | null;
  }> = [];

  for (const [dayKey, evs] of Object.entries(rowsByDay)) {
    for (const e of evs) {
      toInsert.push({
        user_id: user.id,
        day_key: dayKey,
        kind: e.kind,
        ts: new Date(e.ts).toISOString(),
        raw: e.raw ?? null,
      });
    }
  }

  if (mode === "merge") {
    const existing = await supabase
      .from("events")
      .select("day_key, kind, ts")
      .eq("user_id", user.id)
      .in("day_key", days);
    if (existing.error) throw new Error(existing.error.message);
    const seen = new Set(
      (existing.data ?? []).map(
        (r) => `${r.day_key}|${r.kind}|${Math.round(new Date(r.ts).getTime() / 60000)}`,
      ),
    );
    const filtered = toInsert.filter((r) => {
      const k = `${r.day_key}|${r.kind}|${Math.round(new Date(r.ts).getTime() / 60000)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (filtered.length) {
      const { error } = await supabase.from("events").insert(filtered);
      if (error) throw new Error(error.message);
    }
  } else {
    if (toInsert.length) {
      const { error } = await supabase.from("events").insert(toInsert);
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/", "layout");
}

export async function clearAllData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await Promise.all([
    supabase.from("events").delete().eq("user_id", user.id),
    supabase.from("plans").delete().eq("user_id", user.id),
  ]);
  revalidatePath("/", "layout");
}
