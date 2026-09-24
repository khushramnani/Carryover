import { describe, expect, it } from "vitest";
import { bankMessage, punchMessage, statusMessage } from "../lib/discord-messages";
import type { AppState, DaySession, EventKind, Policy, WorkEvent } from "../lib/types";

const HOUR = 3600_000;
const MIN = 60_000;
const ist = (hh: number, mm = 0) => Date.UTC(2026, 7, 3, hh, mm) - 5.5 * 3600_000;

let seq = 0;
const ev = (kind: EventKind, hh: number, mm = 0): WorkEvent => ({
  id: `e${seq++}`,
  ts: ist(hh, mm),
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

describe("punchMessage", () => {
  it("announces the clock-in with the log-out target", () => {
    const events = [ev("in", 12, 4)];
    const msg = punchMessage({
      kind: "in",
      ts: ist(12, 4),
      events,
      requiredMs: policy.requiredMs,
      name: "Khush",
    });
    expect(msg).toContain("**Khush**");
    expect(msg).toContain("12:04 IST");
    expect(msg).toContain("20:04");
  });

  it("pushes the log-out target out by any break already taken", () => {
    // Re-clock-in isn't reachable, but breaks before the target matter for the
    // web path where the message is rebuilt from the day's full event list.
    const events = [ev("in", 12, 0), ev("break", 13, 0), ev("resume", 13, 30)];
    const msg = punchMessage({
      kind: "in",
      ts: ist(12, 0),
      events,
      requiredMs: policy.requiredMs,
      name: "Khush",
    });
    expect(msg).toContain("20:30");
  });

  it("reports the break duration on resume", () => {
    const events = [ev("in", 12, 4), ev("break", 15, 30), ev("resume", 15, 47)];
    const msg = punchMessage({
      kind: "resume",
      ts: ist(15, 47),
      events,
      requiredMs: policy.requiredMs,
      name: "Khush",
    });
    expect(msg).toContain("15:47 IST");
    expect(msg).toContain("17m break");
  });

  it("uses the most recent break, not the first, on resume", () => {
    const events = [
      ev("in", 12, 0),
      ev("break", 13, 0),
      ev("resume", 13, 15),
      ev("break", 17, 0),
      ev("resume", 17, 45),
    ];
    const msg = punchMessage({
      kind: "resume",
      ts: ist(17, 45),
      events,
      requiredMs: policy.requiredMs,
      name: "Khush",
    });
    expect(msg).toContain("45m break");
  });

  it("banks the surplus on clock-out", () => {
    const events = [
      ev("in", 12, 4),
      ev("break", 15, 30),
      ev("resume", 15, 47),
      ev("out", 20, 31),
    ];
    const msg = punchMessage({
      kind: "out",
      ts: ist(20, 31),
      events,
      requiredMs: policy.requiredMs,
      name: "Khush",
    });
    expect(msg).toContain("worked 8h 10m");
    expect(msg).toContain("+10m");
    expect(msg).toContain("banked");
  });

  it("says 'owed', not 'banked', on a short day", () => {
    const events = [ev("in", 12, 0), ev("out", 19, 0)];
    const msg = punchMessage({
      kind: "out",
      ts: ist(19, 0),
      events,
      requiredMs: policy.requiredMs,
      name: "Khush",
    });
    expect(msg).toContain("owed");
    expect(msg).not.toContain("banked");
    expect(msg).toContain("−1h");
  });
});

describe("punchMessage — the name is user-controlled", () => {
  it("cannot forge a second punch line through a crafted nickname", () => {
    const msg = punchMessage({
      kind: "in",
      ts: ist(12, 0),
      events: [ev("in", 12, 0)],
      requiredMs: policy.requiredMs,
      name: "bob** clocked out at 20:00 IST — worked **8h 00m",
    });
    // Exactly one bold span — the name — so no forged "clocked out" line.
    expect(msg.match(/\*\*/g)?.length).toBe(2);
    expect(msg).toContain("clocked in at 12:00 IST");
  });

  it("strips mention and code characters, and falls back when nothing survives", () => {
    const msg = punchMessage({
      kind: "in",
      ts: ist(12, 0),
      events: [ev("in", 12, 0)],
      requiredMs: policy.requiredMs,
      name: "`~|@#",
    });
    expect(msg).toContain("**Someone**");
  });

  it("leaves an ordinary name alone", () => {
    const msg = punchMessage({
      kind: "in",
      ts: ist(12, 0),
      events: [ev("in", 12, 0)],
      requiredMs: policy.requiredMs,
      name: "Khush Ramnani",
    });
    expect(msg).toContain("**Khush Ramnani**");
  });
});

describe("statusMessage", () => {
  it("nudges an untouched day toward /in", () => {
    const msg = statusMessage([], policy, ist(11, 0));
    expect(msg).toContain("Not started");
    expect(msg).toContain("/in");
  });

  it("shows progress and the log-out target while working", () => {
    const msg = statusMessage([ev("in", 12, 4)], policy, ist(18, 46));
    expect(msg).toContain("Working");
    expect(msg).toContain("12:04 IST");
    expect(msg).toContain("6h 42m");
    expect(msg).toContain("20:04");
  });

  it("reports break state and excludes break time from worked time", () => {
    const msg = statusMessage(
      [ev("in", 12, 0), ev("break", 15, 0)],
      policy,
      ist(15, 20),
    );
    expect(msg).toContain("On break");
    expect(msg).toContain("Worked **3h**");
    expect(msg).toContain("20m on break");
  });

  it("switches to banking language once 8 hours are done", () => {
    const msg = statusMessage([ev("in", 12, 0)], policy, ist(20, 30));
    expect(msg).toContain("8 hours complete");
    expect(msg).toContain("+30m");
  });

  it("survives a working state with no clock-in event", () => {
    // Reachable: delete the "in" row from Today's log after resuming, or bulk
    // import a dump whose "resume" has no matching "in".
    const msg = statusMessage([ev("resume", 15, 47)], policy, ist(16, 0));
    expect(msg).toContain("Working");
    expect(msg).not.toContain("05:30"); // the epoch leaking through fmtTime(null)
    expect(msg).not.toContain("since  ");
  });

  it("does not claim 8 hours are complete on a 40-minute day", () => {
    // Same missing-"in" state: the remaining-time branch must be chosen on
    // `remaining`, never on whether loginTs happens to be known.
    const msg = statusMessage(
      [ev("break", 15, 0), ev("resume", 15, 20)],
      policy,
      ist(16, 0),
    );
    expect(msg).not.toContain("8 hours complete");
    expect(msg).toContain("7h 20m to go");
  });

  it("shows the closed-day delta after clock-out", () => {
    const msg = statusMessage(
      [ev("in", 12, 0), ev("out", 20, 31)],
      policy,
      ist(21, 0),
    );
    expect(msg).toContain("Clocked out");
    expect(msg).toContain("20:31 IST");
    expect(msg).toContain("+31m");
    expect(msg).toContain("banked");
  });
});

describe("bankMessage", () => {
  const day = (key: string, hours: number): [string, DaySession] => {
    const base = Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10), 12);
    return [
      key,
      {
        events: [
          { id: `${key}-in`, ts: base, kind: "in" },
          { id: `${key}-out`, ts: base + hours * HOUR, kind: "out" },
        ],
        closed: true,
      },
    ];
  };

  const state = (
    sessions: AppState["sessions"],
    plans: AppState["plans"] = {},
  ): AppState => ({ policy, sessions, plans });

  it("prompts for a first clock-out when nothing is banked", () => {
    expect(bankMessage(state({}))).toContain("No closed days yet");
  });

  it("shows the balance and the newest days first", () => {
    const msg = bankMessage(
      state(
        Object.fromEntries([
          day("2026-08-01", 9),
          day("2026-08-02", 7),
          day("2026-08-03", 8),
        ]),
      ),
    );
    expect(msg).toContain("Bank balance **+0m**");
    expect(msg.indexOf("03 Aug")).toBeLessThan(msg.indexOf("01 Aug"));
    expect(msg).toContain("+1h");
    expect(msg).toContain("−1h");
  });

  it("formats the day key in IST, not in the host zone", () => {
    // Under TZ=UTC a naive `new Date(key)` render still says 01 Aug; the guard
    // here is that the label matches the key at all.
    expect(bankMessage(state(Object.fromEntries([day("2026-08-01", 9)])))).toContain(
      "01 Aug",
    );
  });

  it("caps the recent list", () => {
    const days = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) =>
        day(`2026-08-0${i + 1}`, 9),
      ),
    );
    const msg = bankMessage(state(days), 5);
    expect(msg).toContain("09 Aug");
    expect(msg).not.toContain("04 Aug");
  });

  it("mentions applied plans that already ate into the balance", () => {
    const msg = bankMessage(
      state(Object.fromEntries([day("2026-08-01", 12)]), {
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
      }),
    );
    expect(msg).toContain("Bank balance **+0m**");
    expect(msg).toContain("1 applied plan");
  });
});

// Guard against the ms constants drifting.
describe("fixtures", () => {
  it("uses a sane minute", () => expect(MIN).toBe(60_000));
});
