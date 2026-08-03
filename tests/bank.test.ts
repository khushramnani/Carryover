import { describe, expect, it } from "vitest";
import {
  analyzeSession,
  calculateBank,
  dayDelta,
  sessionsFromEvents,
} from "../lib/bank";
import type { DaySession, EventKind, Policy, WorkEvent } from "../lib/types";

const ist = (y: number, mo: number, d: number, hh = 0, mm = 0) =>
  Date.UTC(y, mo - 1, d, hh, mm) - 5.5 * 3600_000;

const HOUR = 3600_000;
const MIN = 60_000;

let seq = 0;
const ev = (kind: EventKind, ts: number): WorkEvent => ({
  id: `e${seq++}`,
  ts,
  kind,
});

const policy: Policy = {
  requiredMs: 8 * HOUR,
  officialStart: "12:00",
  officialEnd: "20:00",
  breakCountsAgainst: false,
  theme: "dark",
  phrases: { in: [], out: [], break: [], resume: [] },
};

describe("analyzeSession", () => {
  it("reports an empty day as off", () => {
    const a = analyzeSession([]);
    expect(a).toMatchObject({ state: "off", workedMs: 0, breakMs: 0, loginTs: null });
  });

  it("sums a clean 8h day with a 30m break", () => {
    const day = ist(2026, 8, 3);
    const a = analyzeSession(
      [
        ev("in", day + 12 * HOUR),
        ev("break", day + 15 * HOUR),
        ev("resume", day + 15 * HOUR + 30 * MIN),
        ev("out", day + 20 * HOUR + 30 * MIN),
      ],
      { includeOpen: false },
    );
    expect(a.state).toBe("off");
    expect(a.workedMs).toBe(8 * HOUR);
    expect(a.breakMs).toBe(30 * MIN);
    expect(a.loginTs).toBe(day + 12 * HOUR);
    expect(a.logoutTs).toBe(day + 20 * HOUR + 30 * MIN);
  });

  it("counts the open tail up to `now` while working", () => {
    const day = ist(2026, 8, 3);
    const a = analyzeSession([ev("in", day + 12 * HOUR)], { now: day + 14 * HOUR });
    expect(a.state).toBe("working");
    expect(a.workedMs).toBe(2 * HOUR);
  });

  it("counts the open tail as break time while on break", () => {
    const day = ist(2026, 8, 3);
    const a = analyzeSession(
      [ev("in", day + 12 * HOUR), ev("break", day + 13 * HOUR)],
      { now: day + 13 * HOUR + 20 * MIN },
    );
    expect(a.state).toBe("break");
    expect(a.workedMs).toBe(1 * HOUR);
    expect(a.breakMs).toBe(20 * MIN);
  });

  it("ignores the open tail when includeOpen is false", () => {
    const day = ist(2026, 8, 3);
    const a = analyzeSession([ev("in", day + 12 * HOUR)], {
      now: day + 14 * HOUR,
      includeOpen: false,
    });
    expect(a.workedMs).toBe(0);
  });

  it("sorts unordered events before analysing", () => {
    const day = ist(2026, 8, 3);
    const a = analyzeSession(
      [ev("out", day + 20 * HOUR), ev("in", day + 12 * HOUR)],
      { includeOpen: false },
    );
    expect(a.workedMs).toBe(8 * HOUR);
  });

  it("handles multiple breaks in one day", () => {
    const day = ist(2026, 8, 3);
    const a = analyzeSession(
      [
        ev("in", day + 12 * HOUR),
        ev("break", day + 13 * HOUR),
        ev("resume", day + 13 * HOUR + 15 * MIN),
        ev("break", day + 17 * HOUR),
        ev("resume", day + 17 * HOUR + 45 * MIN),
        ev("out", day + 21 * HOUR),
      ],
      { includeOpen: false },
    );
    expect(a.breakMs).toBe(60 * MIN);
    expect(a.workedMs).toBe(8 * HOUR);
  });
});

describe("dayDelta", () => {
  it("credits overtime and debits a short day", () => {
    const day = ist(2026, 8, 3);
    const closed = (hours: number) => ({
      events: [ev("in", day + 12 * HOUR), ev("out", day + (12 + hours) * HOUR)],
      closed: true,
    });
    expect(dayDelta(closed(9), policy)).toBe(1 * HOUR);
    expect(dayDelta(closed(7), policy)).toBe(-1 * HOUR);
    expect(dayDelta(closed(8), policy)).toBe(0);
  });
});

describe("calculateBank", () => {
  const day = (key: string, hours: number, closed = true): [string, DaySession] => {
    const base = Date.UTC(
      +key.slice(0, 4),
      +key.slice(5, 7) - 1,
      +key.slice(8, 10),
      12,
    );
    return [key, { events: [ev("in", base), ev("out", base + hours * HOUR)], closed }];
  };

  it("nets credits against debits and skips open days", () => {
    const sessions = Object.fromEntries([
      day("2026-08-01", 9),
      day("2026-08-02", 7),
      day("2026-08-03", 10, false), // still open — must not count
    ]);
    const bank = calculateBank(sessions, {}, policy);
    expect(bank.credits).toBe(1 * HOUR);
    expect(bank.debits).toBe(1 * HOUR);
    expect(bank.total).toBe(0);
    expect(bank.byDay.map((d) => d.key)).toEqual(["2026-08-01", "2026-08-02"]);
  });

  it("subtracts applied plans from the total but not from credits", () => {
    const sessions = Object.fromEntries([day("2026-08-01", 12)]);
    const plans = {
      "2026-08-05": {
        id: "p1",
        dayKey: "2026-08-05",
        preset: "half",
        presetTitle: "Half day",
        costMs: 4 * HOUR,
        note: null,
        applied: true,
        createdAt: 0,
      },
      "2026-08-06": {
        id: "p2",
        dayKey: "2026-08-06",
        preset: "off",
        presetTitle: "Day off",
        costMs: 8 * HOUR,
        note: null,
        applied: false, // not applied — must not be charged
        createdAt: 0,
      },
    };
    const bank = calculateBank(sessions, plans, policy);
    expect(bank.credits).toBe(4 * HOUR);
    expect(bank.total).toBe(0);
  });

  it("returns byDay sorted by key", () => {
    const sessions = Object.fromEntries([
      day("2026-08-03", 8),
      day("2026-08-01", 8),
      day("2026-08-02", 8),
    ]);
    expect(calculateBank(sessions, {}, policy).byDay.map((d) => d.key)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });
});

describe("sessionsFromEvents", () => {
  it("buckets by IST day, not by the host's local day", () => {
    // 18:31Z is 00:01 IST the following morning.
    const sessions = sessionsFromEvents([
      ev("in", Date.UTC(2026, 7, 3, 13, 0)), // 18:30 IST, 3 Aug
      ev("out", Date.UTC(2026, 7, 3, 18, 31)), // 00:01 IST, 4 Aug
    ]);
    expect(Object.keys(sessions).sort()).toEqual(["2026-08-03", "2026-08-04"]);
    expect(sessions["2026-08-04"].closed).toBe(true);
    expect(sessions["2026-08-03"].closed).toBe(false);
  });

  it("sorts each day's events by time", () => {
    const day = ist(2026, 8, 3);
    const sessions = sessionsFromEvents([
      ev("out", day + 20 * HOUR),
      ev("in", day + 12 * HOUR),
    ]);
    expect(sessions["2026-08-03"].events.map((e) => e.kind)).toEqual(["in", "out"]);
  });
});
