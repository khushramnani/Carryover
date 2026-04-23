const TIMEZONE = "Asia/Kolkata";

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

export function fmtDate(
  ts: number | Date,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    ...opts,
  });
}

export function fmtDateFull(ts: number | Date): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dayKey(ts: number | Date): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function timeOnDay(dayTs: number, hh: number, mm: number): number {
  const d = new Date(dayTs);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}
