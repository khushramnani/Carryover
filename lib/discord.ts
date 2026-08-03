import { DEFAULT_PHRASES } from "./phrases";
import { addDays, timeOnDay, dayKey, istWallClock } from "./time";
import { uid } from "./utils";
import type { EventKind, WorkEvent } from "./types";

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyMessage(
  txt: string,
  phrases: Record<EventKind, string[]> | null = null,
): EventKind | null {
  const s = norm(txt || "");
  if (!s) return null;
  const bank = phrases || DEFAULT_PHRASES;
  const entries: Array<{ kind: EventKind; p: string }> = [];
  for (const kind of ["in", "out", "break", "resume"] as EventKind[]) {
    for (const p of bank[kind] || []) {
      const np = norm(p);
      if (np) entries.push({ kind, p: np });
    }
  }
  entries.sort((a, b) => b.p.length - a.p.length);
  for (const { kind, p } of entries) {
    if (
      s === p ||
      s.startsWith(p + " ") ||
      s.endsWith(" " + p) ||
      s.includes(" " + p + " ") ||
      s.includes(p)
    ) {
      return kind;
    }
  }
  return null;
}

export function parseDiscordHeader(
  line: string,
  refNow: number = Date.now(),
): { ts: number } | null {
  const s = line.trim();
  if (!s) return null;

  let m = s.match(
    /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})[,\s]+(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/,
  );
  if (m) {
    const [, dd, mm, yy, hh, mi, ap] = m;
    let year = parseInt(yy, 10);
    if (year < 100) year += 2000;
    let H = parseInt(hh, 10);
    if (ap?.toLowerCase() === "pm" && H < 12) H += 12;
    if (ap?.toLowerCase() === "am" && H === 12) H = 0;
    // Discord exports show wall-clock in the reader's zone; everyone here is IST.
    const ts = istWallClock(year, parseInt(mm, 10) - 1, parseInt(dd, 10), H, parseInt(mi, 10));
    if (!isNaN(ts)) return { ts };
  }

  m = s.match(/(\d{4})-(\d{2})-(\d{2})[\sT](\d{1,2}):(\d{2})/);
  if (m) {
    const [, y, mo, dd, hh, mi] = m;
    const ts = istWallClock(+y, +mo - 1, +dd, +hh, +mi);
    if (!isNaN(ts)) return { ts };
  }

  m = s.match(/\b(yesterday|today)\s*(?:at\s*)?(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/i);
  if (m) {
    const [, kind, hh, mi, ap] = m;
    let H = parseInt(hh, 10);
    if (ap?.toLowerCase() === "pm" && H < 12) H += 12;
    if (ap?.toLowerCase() === "am" && H === 12) H = 0;
    const base = kind.toLowerCase() === "yesterday" ? addDays(refNow, -1) : refNow;
    return { ts: timeOnDay(base, H, parseInt(mi, 10)) };
  }

  const body = classifyMessage(s, null);
  if (!body) {
    m = s.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/);
    if (m && s.length < 80) {
      let H = parseInt(m[1], 10);
      if (m[3]?.toLowerCase() === "pm" && H < 12) H += 12;
      if (m[3]?.toLowerCase() === "am" && H === 12) H = 0;
      return { ts: timeOnDay(refNow, H, parseInt(m[2], 10)) };
    }
  }

  return null;
}

export interface DiscordDump {
  events: WorkEvent[];
  sessions: Record<string, WorkEvent[]>;
  unparsed: string[];
}

export function parseDiscordDump(
  text: string,
  refNow: number = Date.now(),
  phrases: Record<EventKind, string[]> | null = null,
): DiscordDump {
  const rawLines = text.split(/\r?\n/);
  const events: WorkEvent[] = [];
  const unparsed: string[] = [];

  let pendingHeader: { ts: number } | null = null;
  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-—=_]+$/.test(line)) continue;

    const header = parseDiscordHeader(line, refNow);
    if (header) {
      pendingHeader = header;
      continue;
    }

    const kind = classifyMessage(line, phrases);
    if (kind && pendingHeader) {
      events.push({ id: uid(), ts: pendingHeader.ts, kind, raw: line });
      pendingHeader = null;
    } else if (kind && !pendingHeader) {
      unparsed.push(line + "  (no date context)");
    }
  }

  events.sort((a, b) => a.ts - b.ts);

  const sessions: Record<string, WorkEvent[]> = {};
  for (const e of events) {
    const k = dayKey(e.ts);
    if (!sessions[k]) sessions[k] = [];
    sessions[k].push(e);
  }

  return { events, sessions, unparsed };
}
