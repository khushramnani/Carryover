import { cache } from "react";
import { cookies } from "next/headers";
import { DEMO_COOKIE, demoEnabled } from "./demo";
import { createClient } from "./supabase/server";
import { sessionsFromEvents, plansFromRows } from "./bank";
import { DEFAULT_POLICY, mapEvent, mapPlan, mapProfile } from "./mappers";
import type { AppState } from "./types";
import type { ProfileRow } from "./supabase/types";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Raw profile row — carries the Discord identity that the policy mapper drops. */
export const getProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data ?? null;
});

/** Test-user mode: no Supabase session, but the demo cookie is set (see lib/demo.ts). */
export const isDemoSession = cache(async (): Promise<boolean> => {
  if (!demoEnabled()) return false;
  if (await getUser()) return false; // a real sign-in always wins
  return (await cookies()).get(DEMO_COOKIE)?.value === "1";
});

export const getAppState = cache(async (): Promise<AppState | null> => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) {
    // Real data for a demo visitor lives in their browser; DemoProvider swaps it in.
    return (await isDemoSession())
      ? { policy: DEFAULT_POLICY, sessions: {}, plans: {} }
      : null;
  }

  const [profile, { data: events }, { data: plans }] = await Promise.all([
    getProfile(),
    supabase.from("events").select("*").eq("user_id", user.id).order("ts", { ascending: true }),
    supabase.from("plans").select("*").eq("user_id", user.id),
  ]);

  return {
    policy: profile ? mapProfile(profile) : DEFAULT_POLICY,
    sessions: sessionsFromEvents((events ?? []).map(mapEvent)),
    plans: plansFromRows((plans ?? []).map(mapPlan)),
  };
});
