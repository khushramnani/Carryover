"use client";

import { useMemo, useState } from "react";
import { Stat } from "@/components/stat";
import { analyzeSession, calculateBank } from "@/lib/bank";
import { fmtDayKey, fmtDayKeyFull, fmtHMCompact, fmtTime } from "@/lib/time";
import { MS } from "@/lib/utils";
import type { AppState } from "@/lib/types";

interface HistoryViewProps {
  state: AppState;
}

type Range = "7" | "14" | "30";

export function HistoryView({ state }: HistoryViewProps) {
  const [range, setRange] = useState<Range>("14");

  const byDay = useMemo(
    () => calculateBank(state.sessions, state.plans, state.policy).byDay,
    [state.sessions, state.plans, state.policy],
  );

  const n = parseInt(range, 10);
  const items = byDay.slice(-n);
  const maxAbs = Math.max(1 * MS.hr, ...items.map((d) => Math.abs(d.delta)));

  const totals = items.reduce(
    (acc, d) => {
      acc.delta += d.delta;
      const a = analyzeSession(d.session.events, { includeOpen: false });
      acc.worked += a.workedMs;
      acc.breaks += a.breakMs;
      return acc;
    },
    { delta: 0, worked: 0, breaks: 0 },
  );

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="stats">
        <Stat label="Days tracked" value={items.length} sub={`last ${n} days`} />
        <Stat
          label="Total worked"
          value={fmtHMCompact(totals.worked)}
          sub={`avg ${fmtHMCompact(items.length ? totals.worked / items.length : 0)}/day`}
        />
        <Stat
          label="Total break"
          value={fmtHMCompact(totals.breaks)}
          sub={`avg ${fmtHMCompact(items.length ? totals.breaks / items.length : 0)}/day`}
        />
        <Stat
          label="Net delta"
          value={
            (totals.delta >= 0 ? "+" : "−") + fmtHMCompact(Math.abs(totals.delta))
          }
          sub={totals.delta >= 0 ? "banked" : "owed"}
          tone={totals.delta >= 0 ? "credit" : "debit"}
        />
      </div>

      <div className="card">
        <div className="card-title">
          Daily delta vs. 8hr baseline
          <span className="row" style={{ gap: 6 }}>
            {(["7", "14", "30"] as Range[]).map((r) => (
              <button
                key={r}
                className={`btn ${range === r ? "primary" : "ghost"}`}
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setRange(r)}
              >
                {r}d
              </button>
            ))}
          </span>
        </div>

        <div className="hist-chart">
          {items.length === 0 && (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              No closed days in this range yet.
            </div>
          )}
          {items.map(({ key, delta }) => {
            const h = (Math.abs(delta) / maxAbs) * 70;
            return (
              <div
                className="hist-bar-wrap"
                key={key}
                title={`${fmtDayKey(key)}: ${delta >= 0 ? "+" : "−"}${fmtHMCompact(Math.abs(delta))}`}
              >
                <div className="hist-bar-col">
                  <div className="hist-baseline" style={{ bottom: "50%" }} />
                  {delta >= 0 ? (
                    <>
                      <div style={{ height: "50%" }} />
                      <div className="hist-bar credit" style={{ height: `${h}%` }} />
                    </>
                  ) : (
                    <div
                      className="hist-bar debit"
                      style={{ height: `${h}%`, marginTop: "50%" }}
                    />
                  )}
                </div>
                <span className="hist-label">{key.slice(8)}</span>
              </div>
            );
          })}
        </div>

        <table className="hist-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Log in</th>
              <th>Log out</th>
              <th>Worked</th>
              <th>Breaks</th>
              <th style={{ textAlign: "right" }}>Delta</th>
            </tr>
          </thead>
          <tbody>
            {[...items].reverse().map(({ key, delta, session }) => {
              const a = analyzeSession(session.events, { includeOpen: false });
              return (
                <tr key={key}>
                  <td className="name">{fmtDayKeyFull(key)}</td>
                  <td>{a.loginTs ? fmtTime(a.loginTs) : "—"}</td>
                  <td>{a.logoutTs ? fmtTime(a.logoutTs) : "—"}</td>
                  <td>{fmtHMCompact(a.workedMs)}</td>
                  <td>{fmtHMCompact(a.breakMs)}</td>
                  <td
                    className={delta >= 0 ? "credit" : "debit"}
                    style={{ textAlign: "right" }}
                  >
                    {delta >= 0 ? "+" : "−"}
                    {fmtHMCompact(Math.abs(delta))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
