"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Banner } from "@/components/banner";
import { calculateBank } from "@/lib/bank";
// Labels format selKey, not selectedDay: selectedDay is an IST-fixed midnight,
// so rendering it in the host zone shows the previous day on a UTC server and
// disagrees with the day_key the Apply button actually writes.
import { dayKey as dk, fmtDayKey, fmtDayKeyFull, fmtHMCompact, startOfDay, addDays } from "@/lib/time";
import { MS } from "@/lib/utils";
import { applyPlan, removePlan as removePlanAction } from "@/lib/actions";
import type { AppState } from "@/lib/types";

type PresetId = "half" | "late" | "early" | "full" | "custom";

interface PlanViewProps {
  state: AppState;
}

export function PlanView({ state }: PlanViewProps) {
  const today = startOfDay(Date.now());
  const searchParams = useSearchParams();
  const presetFromUrl = searchParams.get("preset") as PresetId | null;

  // TZ: the calendar grid is built from the browser's local Date. Correct for
  // any zone from UTC-5:30 eastwards (dayKey() shifts to IST before bucketing),
  // and every user is in IST today. Move to IST-fixed math if that changes.
  const [monthBase, setMonthBase] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const [selectedDay, setSelectedDay] = useState(addDays(today, 1));
  const [preset, setPreset] = useState<PresetId>(presetFromUrl || "half");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (presetFromUrl) setPreset(presetFromUrl);
  }, [presetFromUrl]);

  const bank = useMemo(
    () => calculateBank(state.sessions, state.plans, state.policy),
    [state.sessions, state.plans, state.policy],
  );
  const available = Math.max(0, bank.total);
  const required = state.policy.requiredMs;

  const defaultHours = useMemo(
    () => ({
      half: required / 2 / MS.hr,
      late: 2,
      early: 2,
      full: required / MS.hr,
      custom: 1,
    }),
    [required],
  );

  const [customHours, setCustomHours] = useState<Record<PresetId, number>>(
    () => ({ ...defaultHours }),
  );

  const buildSub = (id: PresetId, hrs: number): string => {
    const [sh, sm] = state.policy.officialStart.split(":").map(Number);
    const [eh, em] = state.policy.officialEnd.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const shiftMin = Math.round(hrs * 60);
    if (id === "half") return `Work ${required / MS.hr - hrs} hrs`;
    if (id === "late") {
      const m = startMin + shiftMin;
      return `Start ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    }
    if (id === "early") {
      const m = endMin - shiftMin;
      return `Leave ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    }
    if (id === "full") return "Skip entirely";
    if (id === "custom") return "Your own duration";
    return "";
  };

  const presetBase: Array<{
    id: PresetId;
    title: string;
    hrs: number;
    editable: boolean;
  }> = [
    { id: "half", title: "Half-day", hrs: customHours.half, editable: true },
    { id: "late", title: "Late start", hrs: customHours.late, editable: true },
    { id: "early", title: "Leave early", hrs: customHours.early, editable: true },
    { id: "full", title: "Day off", hrs: customHours.full, editable: false },
    { id: "custom", title: "Custom", hrs: customHours.custom, editable: true },
  ];

  const presets = presetBase.map((p) => ({
    ...p,
    cost: p.hrs * MS.hr,
    sub: buildSub(p.id, p.hrs),
  }));

  const activePreset = presets.find((p) => p.id === preset) || presets[0];

  const firstDow = new Date(monthBase).getDay();
  const monthEnd = new Date(monthBase);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  const daysInMonth = monthEnd.getDate();

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(addDays(monthBase, d - 1));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(monthBase).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const selKey = dk(selectedDay);
  const existingPlan = state.plans[selKey];

  const setHrs = (id: PresetId, v: string) => {
    const n = Math.max(0, Math.min(24, parseFloat(v) || 0));
    setCustomHours({ ...customHours, [id]: n });
  };

  const doApply = () => {
    if (available < activePreset.cost || activePreset.cost <= 0) return;
    startTransition(async () => {
      try {
        await applyPlan(selKey, {
          preset: activePreset.id,
          presetTitle: activePreset.title,
          costMs: activePreset.cost,
          note: note.trim() || null,
          applied: true,
        });
        setNote("");
      } catch (err) {
        console.error(err);
      }
    });
  };

  const doRemove = (dayKey: string) => {
    startTransition(async () => {
      try {
        await removePlanAction(dayKey);
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <div className="plan-wrap">
      <div className="card">
        <div className="card-title">
          <span className="row" style={{ gap: 10 }}>
            <button
              className="btn ghost"
              style={{ padding: "4px 10px" }}
              onClick={() => {
                const d = new Date(monthBase);
                d.setMonth(d.getMonth() - 1);
                setMonthBase(d.getTime());
              }}
            >
              ‹
            </button>
            <span
              style={{
                color: "var(--text)",
                fontSize: 14,
                fontFamily: "var(--font-ui)",
                textTransform: "none",
                letterSpacing: 0,
                fontWeight: 500,
              }}
            >
              {monthLabel}
            </span>
            <button
              className="btn ghost"
              style={{ padding: "4px 10px" }}
              onClick={() => {
                const d = new Date(monthBase);
                d.setMonth(d.getMonth() + 1);
                setMonthBase(d.getTime());
              }}
            >
              ›
            </button>
          </span>
          <span className="meta">click a day to plan</span>
        </div>

        <div className="cal">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="cal-head">
              {d}
            </div>
          ))}
          {cells.map((ts, i) => {
            if (ts == null) return <div key={i} className="cal-day muted" />;
            const k = dk(ts);
            const isPast = ts < today;
            const isToday = ts === today;
            const isSelected = ts === selectedDay;
            const plan = state.plans[k];
            const hist = state.sessions[k];
            return (
              <div
                key={i}
                className={`cal-day ${isPast ? "past" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${plan ? "has-plan" : ""} ${hist ? "has-hist" : ""}`}
                onClick={() => !isPast && setSelectedDay(ts)}
              >
                <span className="cal-num">{new Date(ts).getDate()}</span>
                <span className="cal-mark">
                  {plan
                    ? (plan.presetTitle || "").split(" ")[0].toLowerCase()
                    : hist
                      ? "✓"
                      : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="plan-card">
        <div className="card">
          <div className="card-title">
            Selected day <span className="meta">{fmtDayKeyFull(selKey)}</span>
          </div>

          {existingPlan ? (
            <>
              <Banner
                tone="credit"
                eyebrow="Plan applied"
                main={
                  (existingPlan.presetTitle ||
                    presets.find((p) => p.id === existingPlan.preset)?.title ||
                    "") +
                  " · −" +
                  fmtHMCompact(existingPlan.costMs)
                }
                hint={existingPlan.note || "No note"}
              />
              <div className="btn-row" style={{ marginTop: 16 }}>
                <button
                  className="btn danger"
                  onClick={() => doRemove(selKey)}
                  disabled={isPending}
                >
                  Remove plan
                </button>
              </div>
            </>
          ) : (
            <>
              <Banner
                tone={available >= activePreset.cost ? "" : "debit"}
                eyebrow="Available bank"
                main={"+" + fmtHMCompact(available)}
                hint={
                  available >= activePreset.cost
                    ? `After this plan: +${fmtHMCompact(available - activePreset.cost)}`
                    : `Not enough credit — short by ${fmtHMCompact(activePreset.cost - available)}`
                }
              />

              <div style={{ marginTop: 18 }}>
                <div className="tiny" style={{ marginBottom: 8 }}>
                  CHOOSE TYPE · CLICK NUMBER TO EDIT
                </div>
                <div className="preset-row">
                  {presets.map((p) => {
                    const selected = preset === p.id;
                    return (
                      <button
                        key={p.id}
                        className={`preset ${selected ? "selected" : ""}`}
                        onClick={() => setPreset(p.id)}
                      >
                        <span className="title">{p.title}</span>
                        <span
                          className="sub"
                          style={{ display: "flex", alignItems: "center", gap: 4 }}
                        >
                          −
                          {p.editable && selected ? (
                            <input
                              type="number"
                              min="0"
                              max="24"
                              step="0.25"
                              value={p.hrs}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setHrs(p.id, e.target.value)}
                              style={{
                                width: 52,
                                padding: "2px 6px",
                                textAlign: "center",
                                background: "var(--bg-elev-2)",
                                color: "var(--text)",
                                border: "1px solid var(--border-strong)",
                                borderRadius: 4,
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                              }}
                            />
                          ) : (
                            <span>{p.hrs}h</span>
                          )}
                          <span>· {p.sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="tiny" style={{ marginBottom: 6 }}>
                  NOTE (OPTIONAL)
                </div>
                <input
                  className="input wide"
                  placeholder="e.g. Doctor's appointment"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <button
                className="btn primary full lg"
                style={{ marginTop: 16 }}
                onClick={doApply}
                disabled={
                  isPending ||
                  available < activePreset.cost ||
                  activePreset.cost <= 0
                }
              >
                Apply plan · spend {fmtHMCompact(activePreset.cost)}
              </button>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            Upcoming plans <span className="meta">{Object.keys(state.plans).length}</span>
          </div>
          {Object.keys(state.plans).length === 0 && (
            <div className="empty">No plans yet. Pick a day and apply one.</div>
          )}
          {Object.values(state.plans)
            .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
            .map((plan) => (
              <div
                key={plan.id}
                className="event-row"
                style={{ gridTemplateColumns: "auto 1fr auto auto", gap: 12 }}
              >
                <span className="event-time">{fmtDayKey(plan.dayKey)}</span>
                <span className="event-label">
                  {plan.presetTitle ||
                    presets.find((p) => p.id === plan.preset)?.title}
                  {plan.note ? ` · ${plan.note}` : ""}
                </span>
                <span className="tag debit">−{fmtHMCompact(plan.costMs)}</span>
                <button
                  className="event-del"
                  style={{ opacity: 1 }}
                  onClick={() => doRemove(plan.dayKey)}
                  disabled={isPending}
                >
                  remove
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
