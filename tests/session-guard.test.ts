import { describe, expect, it } from "vitest";
import { checkTransition } from "../lib/session-guard";
import type { EventKind, WorkEvent } from "../lib/types";

const ist = (hh: number, mm = 0) =>
  Date.UTC(2026, 7, 3, hh, mm) - 5.5 * 3600_000;

let seq = 0;
const ev = (kind: EventKind, hh: number, mm = 0): WorkEvent => ({
  id: `e${seq++}`,
  ts: ist(hh, mm),
  kind,
});

const NOW = ist(21, 0);

const allow = (events: WorkEvent[], kind: EventKind) =>
  checkTransition(events, kind, NOW).ok;

const denial = (events: WorkEvent[], kind: EventKind) => {
  const r = checkTransition(events, kind, NOW);
  expect(r.ok).toBe(false);
  return r.ok ? "" : r.reason;
};

const FRESH: WorkEvent[] = [];
const WORKING = [ev("in", 12, 4)];
const ON_BREAK = [ev("in", 12, 4), ev("break", 15, 30)];
const RESUMED = [ev("in", 12, 4), ev("break", 15, 30), ev("resume", 15, 47)];
const CLOSED = [ev("in", 12, 4), ev("out", 20, 31)];

describe("checkTransition — the allowed moves", () => {
  it("matches today-view's canLogIn/canBreak/canResume/canLogOut exactly", () => {
    const table: Array<[string, WorkEvent[], Record<EventKind, boolean>]> = [
      ["fresh day", FRESH, { in: true, break: false, resume: false, out: false }],
      ["working", WORKING, { in: false, break: true, resume: false, out: true }],
      ["on break", ON_BREAK, { in: false, break: false, resume: true, out: true }],
      ["resumed", RESUMED, { in: false, break: true, resume: false, out: true }],
      ["clocked out", CLOSED, { in: false, break: false, resume: false, out: false }],
    ];

    for (const [label, events, expected] of table) {
      for (const kind of ["in", "break", "resume", "out"] as EventKind[]) {
        expect(`${label}/${kind}=${allow(events, kind)}`).toBe(
          `${label}/${kind}=${expected[kind]}`,
        );
      }
    }
  });
});

describe("checkTransition — the refusals explain themselves", () => {
  it("tells you when you clocked in", () => {
    expect(denial(WORKING, "in")).toContain("12:04");
  });

  it("tells you when the break started", () => {
    expect(denial(ON_BREAK, "break")).toContain("15:30");
  });

  it("points a double /in on a closed day at the reset", () => {
    const reason = denial(CLOSED, "in");
    expect(reason).toContain("20:31");
    expect(reason.toLowerCase()).toContain("reset");
  });

  it("points /break and /resume at /in when the day hasn't started", () => {
    expect(denial(FRESH, "break")).toContain("/in");
    expect(denial(FRESH, "resume")).toContain("/in");
  });

  it("does not claim you're on a break when you're working", () => {
    expect(denial(WORKING, "resume")).toBe("You're not on a break.");
  });

  it("distinguishes 'never started' from 'already finished' on /out", () => {
    expect(denial(FRESH, "out")).toBe("You're not clocked in.");
    expect(denial(CLOSED, "out")).toContain("already clocked out");
  });
});

describe("checkTransition — ordering", () => {
  it("is insensitive to the order events arrive in", () => {
    const shuffled = [ev("break", 15, 30), ev("in", 12, 4)];
    expect(allow(shuffled, "resume")).toBe(true);
    expect(allow(shuffled, "break")).toBe(false);
  });
});
