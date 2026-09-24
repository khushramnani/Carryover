import { analyzeSession, calculateBank, type BankSummary } from "./bank";
import { fmtDayKey, fmtHMCompact, fmtTime } from "./time";
import type { AppState, EventKind, Policy, WorkEvent } from "./types";

// Pure message templates, shared by the slash-command replies (Discord →
// Carryover) and the web → channel notifications, so a punch reads identically
// whichever side it came from.

export interface PunchContext {
  kind: EventKind;
  /** Timestamp of the event just recorded. */
  ts: number;
  /** All of today's events, including the one just recorded. */
  events: WorkEvent[];
  requiredMs: number;
  name: string;
}

/**
 * Nicknames are user-controlled and get dropped inside **bold**. Without this,
 * a nick of `x** clocked out at 20:00 IST — worked **8h` forges a convincing
 * fake punch line in a channel people read as an audit trail.
 */
function safeName(name: string): string {
  return name.replace(/[\\*_~`|>@#:]/g, "").trim().slice(0, 64) || "Someone";
}

export function punchMessage({
  kind,
  ts,
  events,
  requiredMs,
  name,
}: PunchContext): string {
  const a = analyzeSession(events, { now: ts, includeOpen: false });
  const at = `${fmtTime(ts)} IST`;
  name = safeName(name);

  switch (kind) {
    case "in": {
      const target = a.loginTs != null ? a.loginTs + requiredMs + a.breakMs : null;
      return `🟢 **${name}** clocked in at ${at}${
        target ? ` — log out at ${fmtTime(target)}` : ""
      }`;
    }
    case "break":
      return `⏸️ **${name}** — break started at ${at}`;
    case "resume": {
      const startedAt = lastOfKind(a.events, "break", ts);
      return `▶️ **${name}** back at ${at}${
        startedAt != null ? ` — ${fmtHMCompact(ts - startedAt)} break` : ""
      }`;
    }
    case "out": {
      const delta = a.workedMs - requiredMs;
      return `🔴 **${name}** clocked out at ${at} — worked ${fmtHMCompact(
        a.workedMs,
      )} (**${fmtHMCompact(delta, { signed: true })}** ${
        delta >= 0 ? "banked" : "owed"
      })`;
    }
  }
}

function lastOfKind(events: WorkEvent[], kind: EventKind, before: number): number | null {
  let found: number | null = null;
  for (const e of events) {
    if (e.kind === kind && e.ts <= before) found = e.ts;
  }
  return found;
}

/** `/status` — ephemeral. Mirrors the Today view's headline numbers. */
export function statusMessage(
  events: WorkEvent[],
  policy: Policy,
  now: number = Date.now(),
): string {
  const a = analyzeSession(events, { now });
  const required = policy.requiredMs;

  if (a.state === "off" && events.length === 0) {
    return `⚪ **Not started today** — official window ${policy.officialStart}–${policy.officialEnd} IST. Use \`/in\` to start.`;
  }

  // loginTs can be null even while working — deleting the "in" row from Today's
  // log, or a bulk import with an orphan "resume", both get you there.
  const since = a.loginTs != null ? ` since ${fmtTime(a.loginTs)} IST` : "";

  const lines: string[] = [];
  if (a.state === "working") {
    lines.push(`🟢 **Working**${since}`);
  } else if (a.state === "break") {
    lines.push(
      `⏸️ **On break**${a.lastTs != null ? ` since ${fmtTime(a.lastTs)} IST` : ""}${
        a.loginTs != null ? ` — clocked in ${fmtTime(a.loginTs)}` : ""
      }`,
    );
  } else {
    lines.push(
      `🔴 **Clocked out**${a.logoutTs ? ` at ${fmtTime(a.logoutTs)} IST` : ""}`,
    );
  }

  lines.push(
    `Worked **${fmtHMCompact(a.workedMs)}** of ${fmtHMCompact(required)}${
      a.breakMs > 0 ? ` · ${fmtHMCompact(a.breakMs)} on break` : ""
    }`,
  );

  const remaining = required - a.workedMs;
  if (a.state === "off") {
    const delta = a.workedMs - required;
    lines.push(
      `Day delta **${fmtHMCompact(delta, { signed: true })}** ${delta >= 0 ? "banked" : "owed"}`,
    );
  } else if (remaining > 0) {
    // Only the target time depends on loginTs — gating the whole branch on it
    // sent a 40-minute day into the "8 hours complete" arm below.
    lines.push(
      a.loginTs != null
        ? `Log out at **${fmtTime(a.loginTs + required + a.breakMs)} IST** — ${fmtHMCompact(remaining)} to go`
        : `${fmtHMCompact(remaining)} to go`,
    );
  } else {
    lines.push(
      `8 hours complete — banking **${fmtHMCompact(-remaining, { signed: true })}** so far`,
    );
  }

  return lines.join("\n");
}

/** `/bank` — ephemeral. Balance plus the most recent daily deltas. */
export function bankMessage(state: AppState, limit = 5): string {
  const bank: BankSummary = calculateBank(state.sessions, state.plans, state.policy);
  const recent = bank.byDay.slice(-limit).reverse();

  const lines = [
    `🏦 Bank balance **${fmtHMCompact(bank.total, { signed: true })}**`,
    `Credits ${fmtHMCompact(bank.credits)} · Debits ${fmtHMCompact(bank.debits)}`,
  ];

  if (recent.length === 0) {
    lines.push("_No closed days yet — clock out to bank your first delta._");
  } else {
    lines.push(
      "",
      ...recent.map(
        (d) =>
          `\`${fmtDayKey(d.key)}\`  ${fmtHMCompact(d.delta, { signed: true })}`,
      ),
    );
  }

  const pending = Object.values(state.plans).filter((p) => p.applied);
  if (pending.length > 0) {
    lines.push(
      `_${pending.length} applied plan${pending.length > 1 ? "s" : ""} already charged against this balance._`,
    );
  }

  return lines.join("\n");
}
