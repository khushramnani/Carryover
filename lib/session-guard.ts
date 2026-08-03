import { analyzeSession } from "./bank";
import { fmtTime } from "./time";
import type { EventKind, WorkEvent } from "./types";

/**
 * The clock-in state machine, extracted from today-view.tsx so the Discord
 * bridge enforces exactly the same transitions the web buttons do. Free-text
 * Discord never had this — "logging in" twice just made two messages — and
 * refusing impossible punches is half the point of the bridge.
 *
 * Keep in lockstep with the canLogIn/canBreak/canResume/canLogOut flags in
 * components/today-view.tsx.
 */
export type GuardResult = { ok: true } | { ok: false; reason: string };

const OK: GuardResult = { ok: true };
const no = (reason: string): GuardResult => ({ ok: false, reason });

export function checkTransition(
  events: WorkEvent[],
  kind: EventKind,
  now: number = Date.now(),
): GuardResult {
  const { state, loginTs, logoutTs, lastTs } = analyzeSession(events, { now });

  switch (kind) {
    case "in":
      if (state === "working")
        return no(
          `You're already clocked in${loginTs ? ` since ${fmtTime(loginTs)} IST` : ""}.`,
        );
      if (state === "break")
        return no(
          `You're already clocked in — on a break${lastTs ? ` since ${fmtTime(lastTs)} IST` : ""}. Use \`/resume\`.`,
        );
      if (events.length > 0)
        return no(
          `You've already clocked out today${logoutTs ? ` at ${fmtTime(logoutTs)} IST` : ""}. Reset the day in Carryover if that was a mistake.`,
        );
      return OK;

    case "break":
      if (state === "break")
        return no(
          `You're already on a break${lastTs ? ` since ${fmtTime(lastTs)} IST` : ""}.`,
        );
      if (state !== "working") return no("You're not clocked in. Use `/in` first.");
      return OK;

    case "resume":
      if (state === "working") return no("You're not on a break.");
      if (state !== "break") return no("You're not clocked in. Use `/in` first.");
      return OK;

    case "out":
      if (state === "working" || state === "break") return OK;
      if (events.length > 0)
        return no(
          `You've already clocked out today${logoutTs ? ` at ${fmtTime(logoutTs)} IST` : ""}.`,
        );
      return no("You're not clocked in.");
  }
}
