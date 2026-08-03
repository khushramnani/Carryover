const TIMEZONE = "Asia/Kolkata";

/**
 * Carryover is an IST-only product. IST is a fixed UTC+05:30 with no DST, so
 * every day-boundary helper below does constant-offset math instead of relying
 * on the host's local zone — otherwise a 23:30 IST punch recorded by a UTC
 * serverless function (or the Discord interactions route) lands on the wrong
 * day_key. Do not reintroduce getFullYear/getHours/setHours here.
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function fmtHM(
  ms: number,
  opts: { withSeconds?: boolean; signed?: boolean } = {},
): string {
  const { withSeconds = false, signed = false } = opts;
  const neg = ms < 0;
  const total = Math.abs(Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const sign = signed ? (neg ? "−" : "+") : neg ? "−" : "";
  if (withSeconds) {
    return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${sign}${h}h ${String(m).padStart(2, "0")}m`;
}

export function fmtHMCompact(ms: number, opts: { signed?: boolean } = {}): string {
  const neg = ms < 0;
  const total = Math.abs(Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sign = opts.signed ? (neg ? "−" : "+") : neg ? "−" : "";
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

export function fmtTime(ts: number | Date, zone: string = TIMEZONE): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
    hour12: false,
  });
}

export function fmtTimeWithSec(ts: number | Date, zone: string = TIMEZONE): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: zone,
    hour12: false,
  });
}

// Deliberately no host-zone date formatter here. Calendar dates in this app are
// always day keys, and every timestamp that looks like a date is an IST-fixed
// midnight — formatting either one in the host zone renders the previous day on
// a UTC server. Use fmtDayKey / fmtDayKeyFull.

/**
 * Format a `YYYY-MM-DD` day key. Pinned to UTC because the key is already a
 * calendar date, not an instant — formatting it in the host zone shifts it a
 * day whenever the host is behind UTC (or, for IST-midnight parses, ahead).
 */
export function fmtDayKey(
  key: string,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" },
): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
    ...opts,
    timeZone: "UTC",
  });
}

export function fmtDayKeyFull(key: string): string {
  return fmtDayKey(key, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** `YYYY-MM-DD` of the IST calendar day the instant falls on. */
export function dayKey(ts: number | Date): string {
  const d = new Date((typeof ts === "number" ? ts : ts.getTime()) + IST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Epoch ms of IST midnight opening the day the instant falls on. */
export function startOfDay(ts: number): number {
  const shifted = ts + IST_OFFSET_MS;
  return shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS) - IST_OFFSET_MS;
}

/** IST has no DST, so a calendar day is always exactly 24h. */
export function addDays(ts: number, n: number): number {
  return ts + n * DAY_MS;
}

export function timeOnDay(dayTs: number, hh: number, mm: number): number {
  return startOfDay(dayTs) + hh * 60 * 60 * 1000 + mm * 60 * 1000;
}

/** Interpret a wall-clock reading as IST and return the epoch ms. Month is 0-based. */
export function istWallClock(
  year: number,
  month: number,
  day: number,
  hh: number,
  mm: number,
): number {
  return Date.UTC(year, month, day, hh, mm, 0, 0) - IST_OFFSET_MS;
}

/** Epoch ms of IST midnight for a `YYYY-MM-DD` key. */
export function dayKeyToTs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return istWallClock(y, m - 1, d, 0, 0);
}
