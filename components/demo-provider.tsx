"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as serverActions from "@/lib/actions";
import type { ImportEventInput } from "@/lib/actions";
import { plansFromRows, sessionsFromEvents } from "@/lib/bank";
import { DEFAULT_POLICY } from "@/lib/mappers";
import { dayKey, startOfDay } from "@/lib/time";
import type { AppState, EventKind, Plan, Policy, WorkEvent } from "@/lib/types";

// Mirrors the server actions in lib/actions.ts, but against localStorage.
type Actions = Pick<
  typeof serverActions,
  | "addEvent"
  | "deleteEvent"
  | "resetDay"
  | "updatePolicy"
  | "applyPlan"
  | "removePlan"
  | "importEvents"
  | "clearAllData"
>;

interface DemoData {
  events: WorkEvent[];
  plans: Plan[];
  policy: Policy;
}

const STORAGE_KEY = "carryover-demo-v1";
const H = 60 * 60 * 1000;
const M = 60 * 1000;

/** A week of believable history so Bank and History aren't empty on first look. */
function seed(): DemoData {
  const events: WorkEvent[] = [];
  const todayTs = startOfDay(Date.now());
  // [login offset from IST midnight, break minutes, worked minutes] — nets
  // ~+6h so the Plan tab has enough credit to spend on a half-day.
  const days: Array<[number, number, number]> = [
    [11 * H, 45, 9 * 60 + 30],
    [11 * H + 30 * M, 30, 8 * 60 + 45],
    [10 * H + 30 * M, 60, 10 * 60],
    [11 * H, 40, 9 * 60 + 15],
    [12 * H, 20, 8 * 60 + 30],
  ];
  days.forEach(([start, breakMin, workMin], i) => {
    const base = todayTs - (i + 1) * 24 * H;
    const inTs = base + start;
    const breakTs = inTs + 4 * H;
    const resumeTs = breakTs + breakMin * M;
    const outTs = inTs + workMin * M + breakMin * M;
    for (const [kind, ts] of [
      ["in", inTs],
      ["break", breakTs],
      ["resume", resumeTs],
      ["out", outTs],
    ] as Array<[EventKind, number]>) {
      events.push({ id: crypto.randomUUID(), kind, ts });
    }
  });
  return { events, plans: [], policy: DEFAULT_POLICY };
}

function load(): DemoData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoData;
  } catch {
    // Private window / blocked storage: fall through to a fresh seed.
  }
  return seed();
}

const DemoContext = createContext<{ state: AppState; actions: Actions } | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DemoData | null>(null);

  useEffect(() => setData(load()), []);

  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable: the demo still works for this tab.
    }
  }, [data]);

  const value = useMemo(() => {
    const d = data ?? { events: [], plans: [], policy: DEFAULT_POLICY };
    const update = async (fn: (d: DemoData) => DemoData) =>
      setData((prev) => fn(prev ?? d));

    const actions: Actions = {
      addEvent: (kind: EventKind) =>
        update((d) => ({
          ...d,
          events: [...d.events, { id: crypto.randomUUID(), kind, ts: Date.now() }],
        })),
      deleteEvent: (id: string) =>
        update((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) })),
      resetDay: (key: string) =>
        update((d) => ({ ...d, events: d.events.filter((e) => dayKey(e.ts) !== key) })),
      updatePolicy: (patch: Partial<Policy>) =>
        update((d) => ({ ...d, policy: { ...d.policy, ...patch } })),
      applyPlan: (key: string, plan: Omit<Plan, "id" | "createdAt" | "dayKey">) =>
        update((d) => ({
          ...d,
          plans: [
            ...d.plans.filter((p) => p.dayKey !== key),
            { ...plan, id: crypto.randomUUID(), dayKey: key, createdAt: Date.now() },
          ],
        })),
      removePlan: (key: string) =>
        update((d) => ({ ...d, plans: d.plans.filter((p) => p.dayKey !== key) })),
      importEvents: (rowsByDay: Record<string, ImportEventInput[]>, mode: "replace" | "merge") =>
        update((d) => {
          const days = new Set(Object.keys(rowsByDay));
          const kept = mode === "replace" ? d.events.filter((e) => !days.has(dayKey(e.ts))) : d.events;
          // Same per-minute dedupe as the server's merge mode.
          const seen = new Set(kept.map((e) => `${e.kind}|${Math.round(e.ts / M)}`));
          const added: WorkEvent[] = [];
          for (const evs of Object.values(rowsByDay)) {
            for (const e of evs) {
              const k = `${e.kind}|${Math.round(e.ts / M)}`;
              if (seen.has(k)) continue;
              seen.add(k);
              added.push({ id: crypto.randomUUID(), kind: e.kind, ts: e.ts, raw: e.raw ?? null });
            }
          }
          return { ...d, events: [...kept, ...added] };
        }),
      clearAllData: () => update((d) => ({ ...d, events: [], plans: [] })),
    };

    const state: AppState = {
      policy: d.policy,
      sessions: sessionsFromEvents(d.events.map((e) => ({ ...e }))),
      plans: plansFromRows(d.plans),
    };
    return { state, actions };
  }, [data]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** State + actions for a view: the local demo store if in test-user mode, else the server's. */
export function useCarryover(serverState: AppState): { state: AppState; actions: Actions } {
  const demo = useContext(DemoContext);
  return demo ?? { state: serverState, actions: serverActions };
}
