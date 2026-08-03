import { describe, expect, it } from "vitest";
import {
  addDays,
  dayKey,
  dayKeyToTs,
  istWallClock,
  startOfDay,
  timeOnDay,
} from "../lib/time";

// IST wall-clock -> epoch ms, spelled out longhand so the tests don't lean on
// the helper they're testing.
const ist = (y: number, mo: number, d: number, hh = 0, mm = 0) =>
  Date.UTC(y, mo - 1, d, hh, mm) - 5.5 * 3600_000;

describe("test harness", () => {
  it("runs in a non-IST zone, so the day-boundary assertions mean something", () => {
    expect(new Date().getTimezoneOffset()).toBe(0);
  });
});

describe("dayKey", () => {
  it("keeps a 23:59 IST punch on the same IST day", () => {
    expect(dayKey(ist(2026, 8, 3, 23, 59))).toBe("2026-08-03");
  });

  it("rolls a 00:01 IST punch onto the next IST day", () => {
    expect(dayKey(ist(2026, 8, 4, 0, 1))).toBe("2026-08-04");
  });

  it("maps 18:31Z to the NEXT IST day (this is the bug that broke UTC deploys)", () => {
    expect(dayKey(Date.UTC(2026, 7, 3, 18, 31))).toBe("2026-08-04");
  });

  it("maps 18:29Z to the same IST day", () => {
    expect(dayKey(Date.UTC(2026, 7, 3, 18, 29))).toBe("2026-08-03");
  });

  it("pads single-digit months and days", () => {
    expect(dayKey(ist(2026, 1, 5, 12, 0))).toBe("2026-01-05");
  });

  it("accepts a Date as well as a number", () => {
    expect(dayKey(new Date(ist(2026, 8, 3, 12, 0)))).toBe("2026-08-03");
  });

  it("crosses year boundaries in IST, not UTC", () => {
    // 19:00Z on 31 Dec is already 00:30 IST on 1 Jan.
    expect(dayKey(Date.UTC(2026, 11, 31, 19, 0))).toBe("2027-01-01");
  });
});

describe("startOfDay", () => {
  it("returns IST midnight of the day the instant falls on", () => {
    expect(startOfDay(ist(2026, 8, 3, 23, 59))).toBe(ist(2026, 8, 3));
    expect(startOfDay(ist(2026, 8, 3, 0, 0))).toBe(ist(2026, 8, 3));
  });

  it("is idempotent", () => {
    const t = startOfDay(ist(2026, 8, 3, 14, 22));
    expect(startOfDay(t)).toBe(t);
  });

  it("agrees with dayKey for instants either side of IST midnight", () => {
    for (const t of [
      ist(2026, 8, 3, 0, 0),
      ist(2026, 8, 3, 12, 0),
      ist(2026, 8, 3, 23, 59),
      ist(2026, 8, 4, 0, 1),
    ]) {
      expect(dayKey(startOfDay(t))).toBe(dayKey(t));
    }
  });

  it("handles pre-epoch timestamps without a negative-modulo blowup", () => {
    expect(startOfDay(ist(1969, 6, 20, 20, 17))).toBe(ist(1969, 6, 20));
  });
});

describe("addDays", () => {
  it("advances exactly one IST calendar day", () => {
    expect(addDays(ist(2026, 8, 3, 9, 30), 1)).toBe(ist(2026, 8, 4, 9, 30));
  });

  it("goes backwards and across a month boundary", () => {
    expect(dayKey(addDays(ist(2026, 8, 1, 9, 30), -1))).toBe("2026-07-31");
  });
});

describe("timeOnDay", () => {
  it("builds an IST wall-clock time on the day the reference falls on", () => {
    expect(timeOnDay(ist(2026, 8, 3, 23, 10), 9, 30)).toBe(ist(2026, 8, 3, 9, 30));
  });

  it("is stable regardless of where in the day the reference sits", () => {
    expect(timeOnDay(ist(2026, 8, 3, 0, 5), 20, 0)).toBe(
      timeOnDay(ist(2026, 8, 3, 23, 55), 20, 0),
    );
  });
});

describe("istWallClock / dayKeyToTs", () => {
  it("interprets wall-clock digits as IST", () => {
    expect(istWallClock(2026, 7, 3, 12, 4)).toBe(ist(2026, 8, 3, 12, 4));
  });

  it("round-trips a day key", () => {
    expect(dayKey(dayKeyToTs("2026-08-03"))).toBe("2026-08-03");
    expect(dayKeyToTs("2026-08-03")).toBe(ist(2026, 8, 3));
  });
});
