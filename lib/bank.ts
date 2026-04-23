import type {
  AppState,
  DaySession,
  Plan,
  Policy,
  WorkEvent,
} from "./types";

export interface SessionAnalysis {
  workedMs: number;
  breakMs: number;
  state: "off" | "working" | "break";
  loginTs: number | null;
  logoutTs: number | null;
  lastTs: number | null;
  events: WorkEvent[];
}

export function analyzeSession(
  events: WorkEvent[],
  { now = Date.now(), includeOpen = true }: { now?: number; includeOpen?: boolean } = {},
): SessionAnalysis {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  let workedMs = 0;
  let breakMs = 0;
  let state: "off" | "working" | "break" = "off";
  let lastTs: number | null = null;
  let loginTs: number | null = null;
  let logoutTs: number | null = null;

  for (const e of sorted) {
    if (state === "working" && lastTs != null) workedMs += e.ts - lastTs;
    if (state === "break" && lastTs != null) breakMs += e.ts - lastTs;

    if (e.kind === "in") {
      state = "working";
      loginTs = e.ts;
    } else if (e.kind === "break") {
      state = "break";
    } else if (e.kind === "resume") {
      state = "working";
    } else if (e.kind === "out") {
      state = "off";
      logoutTs = e.ts;
    }

    lastTs = e.ts;
  }

  if (includeOpen && lastTs != null && state !== "off") {
    if (state === "working") workedMs += now - lastTs;
    if (state === "break") breakMs += now - lastTs;
  }

  return { workedMs, breakMs, state, loginTs, logoutTs, lastTs, events: sorted };
}

export function dayDelta(session: DaySession, policy: Policy): number {
  const { workedMs } = analyzeSession(session.events, { includeOpen: false });
  return workedMs - policy.requiredMs;
}

export interface BankSummary {
  total: number;
  credits: number;
  debits: number;
  byDay: Array<{ key: string; delta: number; session: DaySession }>;
}

export function calculateBank(
  sessions: AppState["sessions"],
  plans: AppState["plans"],
  policy: Policy,
): BankSummary {
  let total = 0;
  let credits = 0;
  let debits = 0;
  const byDay: BankSummary["byDay"] = [];

  for (const [key, session] of Object.entries(sessions)) {
    if (!session.closed) continue;
    const delta = dayDelta(session, policy);
    total += delta;
    if (delta >= 0) credits += delta;
    else debits += -delta;
    byDay.push({ key, delta, session });
  }

  for (const [, plan] of Object.entries(plans)) {
    if (plan.applied) total -= plan.costMs;
  }

  byDay.sort((a, b) => a.key.localeCompare(b.key));
  return { total, credits, debits, byDay };
}

export function sessionsFromEvents(
  events: WorkEvent[],
): Record<string, DaySession> {
  const grouped: Record<string, WorkEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const k = `${y}-${m}-${day}`;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(e);
  }
  const out: Record<string, DaySession> = {};
  for (const [k, evs] of Object.entries(grouped)) {
    const sorted = evs.sort((a, b) => a.ts - b.ts);
    out[k] = { events: sorted, closed: sorted.some((e) => e.kind === "out") };
  }
  return out;
}

export function plansFromRows(plans: Plan[]): Record<string, Plan> {
  const out: Record<string, Plan> = {};
  for (const p of plans) out[p.dayKey] = p;
  return out;
}
