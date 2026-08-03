"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { analyzeSession, calculateBank } from "@/lib/bank";
import { fmtDayKey, fmtHMCompact, fmtTime } from "@/lib/time";
import { MS } from "@/lib/utils";
import type { AppState } from "@/lib/types";

interface BankViewProps {
  state: AppState;
}

export function BankView({ state }: BankViewProps) {
  const router = useRouter();

  const bank = useMemo(
    () => calculateBank(state.sessions, state.plans, state.policy),
    [state.sessions, state.plans, state.policy],
  );
  const { total, credits, debits, byDay } = bank;
  const creditMs = total > 0 ? total : 0;
  const required = state.policy.requiredMs;

  const suggestions = [
    {
      id: "half",
      title: "Take a half-day",
      cost: required / 2,
      desc: "Work 4 hours on a chosen day, draw the other 4 from your bank.",
      glyph: "½",
    },
    {
      id: "late",
      title: "Late start",
      cost: 2 * MS.hr,
      desc: "Log in 2 hours late — start your day at 14:00 instead of 12:00.",
      glyph: "↷",
    },
    {
      id: "early",
      title: "Leave early",
      cost: 2 * MS.hr,
      desc: "Log out at 18:00 instead of 20:00 and still meet your 8hr quota.",
      glyph: "↶",
    },
    {
      id: "full",
      title: "Full day off",
      cost: required,
      desc: "Don't log in at all — the whole day is drawn from your bank.",
      glyph: "●",
    },
  ];

  const recent = [...byDay].reverse().slice(0, 7);

  const goPlan = (preset: string) => {
    router.push(`/plan?preset=${preset}`);
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="bank-hero">
        <div className="balance-card">
          <div className="balance-label">Bank balance</div>
          <div className={`balance-value ${total >= 0 ? "credit" : "debit"}`}>
            {total >= 0 ? "+" : "−"}
            {fmtHMCompact(Math.abs(total))}
          </div>
          <div className="balance-sub">
            {total >= 0
              ? `You have ${fmtHMCompact(total)} of credit to spend on future days.`
              : `You owe ${fmtHMCompact(-total)} — work longer sessions to catch up.`}
          </div>
          <hr />
          <div className="row" style={{ gap: 24 }}>
            <div>
              <div className="tiny">CREDITS EARNED</div>
              <div
                className="mono"
                style={{ color: "var(--credit)", fontSize: 18, fontWeight: 500 }}
              >
                +{fmtHMCompact(credits)}
              </div>
            </div>
            <div>
              <div className="tiny">DEBITS OWED</div>
              <div
                className="mono"
                style={{ color: "var(--debit)", fontSize: 18, fontWeight: 500 }}
              >
                −{fmtHMCompact(debits)}
              </div>
            </div>
            <div>
              <div className="tiny">DAYS TRACKED</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 500 }}>
                {byDay.length}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            Ways to spend your credit
            <span className="meta">{fmtHMCompact(creditMs)} available</span>
          </div>
          <div className="spend-list">
            {suggestions.map((s) => {
              const affordable = creditMs >= s.cost;
              return (
                <div
                  className="spend-item"
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goPlan(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") goPlan(s.id);
                  }}
                  title={
                    affordable
                      ? "Plan this on a future day"
                      : "Not enough credit yet — open planner anyway"
                  }
                >
                  <div className="title">
                    <span className="glyph">{s.glyph}</span>
                    {s.title}
                  </div>
                  <div
                    className="cost"
                    style={{ color: affordable ? "var(--text-dim)" : "var(--debit)" }}
                  >
                    −{fmtHMCompact(s.cost)}
                    {!affordable && " · short"}
                  </div>
                  <div className="desc">{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Recent daily deltas
          <span className="meta">last 7 closed days</span>
        </div>
        <table className="hist-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Worked</th>
              <th>Breaks</th>
              <th>In → Out</th>
              <th style={{ textAlign: "right" }}>Delta</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="empty" style={{ textAlign: "center" }}>
                  No closed days yet. Log a full session to start tracking.
                </td>
              </tr>
            )}
            {recent.map(({ key, delta, session }) => {
              const { workedMs, breakMs, loginTs, logoutTs } = analyzeSession(
                session.events,
                { includeOpen: false },
              );
              return (
                <tr key={key}>
                  <td className="name">{fmtDayKey(key)}</td>
                  <td>{fmtHMCompact(workedMs)}</td>
                  <td>{fmtHMCompact(breakMs)}</td>
                  <td>
                    {loginTs ? fmtTime(loginTs) : "—"} →{" "}
                    {logoutTs ? fmtTime(logoutTs) : "—"}
                  </td>
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
