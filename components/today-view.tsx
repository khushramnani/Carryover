"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Banner } from "@/components/banner";
import { EventRow } from "@/components/event-row";
import { analyzeSession } from "@/lib/bank";
import { dayKey, fmtHM, fmtHMCompact, fmtTime } from "@/lib/time";
import { clamp } from "@/lib/utils";
import { useCarryover } from "@/components/demo-provider";
import type { AppState, EventKind } from "@/lib/types";

interface TodayViewProps {
  state: AppState;
}

export function TodayView({ state: serverState }: TodayViewProps) {
  const {
    state,
    actions: { addEvent, deleteEvent, resetDay },
  } = useCarryover(serverState);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayKey = dayKey(now);
  const todaySession = state.sessions[todayKey] || { events: [], closed: false };
  const analysis = useMemo(
    () => analyzeSession(todaySession.events, { now }),
    [todaySession.events, now],
  );

  const { workedMs, breakMs, state: sessionState, loginTs, events } = analysis;
  const required = state.policy.requiredMs;
  const remaining = required - workedMs;
  const delta = workedMs - required;

  const targetLogoutTs = loginTs != null ? loginTs + required + breakMs : null;

  const pct = clamp((workedMs / required) * 100, 0, 100);

  const canLogIn = sessionState === "off" && events.length === 0;
  const canBreak = sessionState === "working";
  const canResume = sessionState === "break";
  const canLogOut = sessionState === "working" || sessionState === "break";

  const breaks: Array<{ start: number; end: number | null }> = [];
  let bStart: number | null = null;
  for (const e of events) {
    if (e.kind === "break") bStart = e.ts;
    else if (e.kind === "resume" && bStart != null) {
      breaks.push({ start: bStart, end: e.ts });
      bStart = null;
    }
  }
  if (bStart != null && sessionState === "break") breaks.push({ start: bStart, end: null });

  const runAction = (kind: EventKind) =>
    startTransition(async () => {
      try {
        await addEvent(kind);
      } catch (err) {
        console.error(err);
      }
    });

  const removeEvent = (id: string) =>
    startTransition(async () => {
      try {
        await deleteEvent(id);
      } catch (err) {
        console.error(err);
      }
    });

  const doReset = () =>
    startTransition(async () => {
      try {
        await resetDay(todayKey);
      } catch (err) {
        console.error(err);
      }
    });

  let bannerEyebrow = "Log in to start";
  let bannerMain = "No session yet today";
  let bannerHint = `Official window ${state.policy.officialStart}–${state.policy.officialEnd} IST`;
  let bannerTone: "" | "credit" | "debit" = "";
  if (loginTs != null) {
    if (remaining > 0) {
      bannerEyebrow = "You can log out at";
      bannerMain = targetLogoutTs ? fmtTime(targetLogoutTs) + " IST" : "—";
      bannerHint = `${fmtHMCompact(remaining)} of work remaining · ${fmtHMCompact(breakMs)} on break`;
    } else {
      bannerEyebrow = "8 hours complete — banking extra";
      bannerMain = "+" + fmtHMCompact(delta) + " credit";
      bannerHint = targetLogoutTs
        ? `Could have logged out at ${fmtTime(targetLogoutTs)} · log out when ready`
        : "Log out when ready";
      bannerTone = "credit";
    }
    if (sessionState === "off" && todaySession.closed) {
      bannerEyebrow = "Session closed";
      bannerMain = (delta >= 0 ? "+" : "") + fmtHMCompact(delta) + (delta >= 0 ? " credited" : " owed");
      bannerHint = `Worked ${fmtHMCompact(workedMs)} of ${fmtHMCompact(required)} required`;
      bannerTone = delta >= 0 ? "credit" : "debit";
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="hero">
        <div className="timer-card">
          <div className="timer-header">
            <span className="timer-label">Worked today</span>
            <span className="timer-status">
              <span
                className={`pulse ${
                  sessionState === "break" ? "paused" : sessionState === "off" ? "off" : ""
                }`}
              />
              {sessionState === "working" && "Working"}
              {sessionState === "break" && "On break"}
              {sessionState === "off" && (todaySession.closed ? "Clocked out" : "Not started")}
            </span>
          </div>

          <div className="timer-main">
            <span className="timer-value">{fmtHM(workedMs, { withSeconds: true })}</span>
            <span className="timer-sub">
              <span>
                of <b>{fmtHMCompact(required)}</b> required
              </span>
              <span>{loginTs ? `started ${fmtTime(loginTs)}` : "—"}</span>
            </span>
          </div>

          <div>
            <div className="timer-progress">
              <div
                className={`timer-progress-fill ${workedMs > required ? "over" : ""}`}
                style={{ width: `${workedMs > required ? 100 : pct}%` }}
              />
            </div>
            <div className="timer-ticks">
              <span>00:00</span>
              <span>02:00</span>
              <span>04:00</span>
              <span>06:00</span>
              <span>{fmtHMCompact(required)}</span>
            </div>
          </div>

          <div className="timer-actions">
            <button
              className="btn primary lg"
              onClick={() => runAction("in")}
              disabled={!canLogIn || isPending}
            >
              Log in
            </button>
            {canResume ? (
              <button
                className="btn lg"
                onClick={() => runAction("resume")}
                disabled={isPending}
              >
                Resume
              </button>
            ) : (
              <button
                className="btn lg"
                onClick={() => runAction("break")}
                disabled={!canBreak || isPending}
              >
                Take break
              </button>
            )}
            <button
              className="btn lg danger"
              onClick={() => runAction("out")}
              disabled={!canLogOut || isPending}
            >
              Log out
            </button>
            <div style={{ flex: 1 }} />
            {todaySession.closed && (
              <button className="btn ghost" onClick={doReset} disabled={isPending}>
                Reset day
              </button>
            )}
          </div>
        </div>

        <div className="grid" style={{ gap: 20, alignContent: "start" }}>
          <Banner tone={bannerTone} eyebrow={bannerEyebrow} main={bannerMain} hint={bannerHint} />

          <div className="info-grid">
            <div className="info-cell">
              <div className="info-label">Logged in</div>
              <div className="info-value">{loginTs ? fmtTime(loginTs) : "—"}</div>
            </div>
            <div className="info-cell">
              <div className="info-label">Official window</div>
              <div className="info-value">
                {state.policy.officialStart}–{state.policy.officialEnd}
              </div>
            </div>
            <div className="info-cell">
              <div className="info-label">Break time</div>
              <div className="info-value">{fmtHMCompact(breakMs)}</div>
            </div>
            <div className="info-cell">
              <div className="info-label">
                {delta >= 0 ? "Credit today" : "Remaining"}
              </div>
              <div className={`info-value ${delta >= 0 ? "credit" : ""}`}>
                {delta >= 0 ? "+" + fmtHMCompact(delta) : fmtHMCompact(-delta)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-title">
            Breaks
            <span className="meta">
              {breaks.length} · {fmtHMCompact(breakMs)} total
            </span>
          </div>
          <div className="breaks-card">
            {breaks.length === 0 && <div className="empty">No breaks yet today</div>}
            {breaks.map((b, i) => (
              <div className={`break-row ${b.end == null ? "active" : ""}`} key={i}>
                <span className="dot" />
                <span className="times">
                  {fmtTime(b.start)} {b.end ? "→ " + fmtTime(b.end) : "→ ongoing"}
                </span>
                <span className="dur">
                  {fmtHMCompact(b.end ? b.end - b.start : now - b.start)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            Today&apos;s log
            <span className="meta">{events.length} events</span>
          </div>
          <div className="event-log">
            {events.length === 0 && <div className="empty">Log in to start tracking</div>}
            {events.map((e) => (
              <EventRow key={e.id} event={e} onDelete={removeEvent} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
