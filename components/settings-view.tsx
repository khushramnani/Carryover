"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { PhraseEditor } from "@/components/phrase-editor";
import { Toggle } from "@/components/toggle";
import { analyzeSession } from "@/lib/bank";
import { DEFAULT_PHRASES } from "@/lib/phrases";
import { parseDiscordDump } from "@/lib/discord";
import { dayKey as dk, fmtDayKey, fmtHMCompact, fmtTime } from "@/lib/time";
import { MS } from "@/lib/utils";
import {
  clearAllData,
  importEvents,
  updatePolicy,
  type ImportEventInput,
} from "@/lib/actions";
import type { AppState, EventKind, Policy } from "@/lib/types";

interface SettingsViewProps {
  state: AppState;
}

export function SettingsView({ state }: SettingsViewProps) {
  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseDiscordDump> | null>(
    null,
  );
  const [mergeMode, setMergeMode] = useState<"replace" | "merge">("replace");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const savePolicy = (patch: Partial<Policy>) =>
    startTransition(async () => {
      try {
        await updatePolicy(patch);
      } catch (err) {
        console.error(err);
      }
    });

  const runParse = (text: string) => {
    const res = parseDiscordDump(text, Date.now(), state.policy.phrases);
    setParsed(res);
  };

  const onPaste = (v: string) => {
    setPasteText(v);
    if (v.trim().length > 10) runParse(v);
    else setParsed(null);
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    setPasteText(text);
    runParse(text);
  };

  const doImport = () => {
    if (!parsed || !parsed.events.length) return;
    const rowsByDay: Record<string, ImportEventInput[]> = {};
    for (const [k, evs] of Object.entries(parsed.sessions)) {
      rowsByDay[k] = evs.map((e) => ({ kind: e.kind, ts: e.ts, raw: e.raw ?? null }));
    }
    startTransition(async () => {
      try {
        await importEvents(rowsByDay, mergeMode);
        setParsed(null);
        setPasteText("");
      } catch (err) {
        console.error(err);
      }
    });
  };

  const clearAll = () => {
    if (!confirm("This wipes all sessions, plans, and settings. Continue?")) return;
    startTransition(async () => {
      try {
        await clearAllData();
      } catch (err) {
        console.error(err);
      }
    });
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carryover-${dk(Date.now())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewDays = useMemo(() => {
    if (!parsed) return [];
    return Object.entries(parsed.sessions)
      .map(([key, events]) => {
        const a = analyzeSession(events, { includeOpen: false });
        const delta = a.workedMs - state.policy.requiredMs;
        return { key, ...a, delta };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [parsed, state.policy.requiredMs]);

  const totalDelta = previewDays.reduce((s, d) => s + d.delta, 0);

  const sample = `khush⚡ — 21-04-2026 07:43
Logging In
khush⚡ — 21-04-2026 09:19
Taking a Break
khush⚡ — 21-04-2026 11:21
Im Back
khush⚡ — 21-04-2026 20:02
Logging Out`;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="grid" style={{ gap: 20, gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <div className="card-title">Work policy</div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Required daily hours</div>
              <div className="setting-desc">Your minimum work quota per day.</div>
            </div>
            <input
              className="input time"
              type="number"
              min="1"
              max="12"
              step="0.5"
              value={state.policy.requiredMs / MS.hr}
              onChange={(e) =>
                savePolicy({
                  requiredMs: parseFloat(e.target.value || "8") * MS.hr,
                })
              }
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Official window start (IST)</div>
              <div className="setting-desc">
                Reference only — timer counts from actual log-in.
              </div>
            </div>
            <input
              className="input time"
              type="time"
              value={state.policy.officialStart}
              onChange={(e) => savePolicy({ officialStart: e.target.value })}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Official window end (IST)</div>
              <div className="setting-desc">For display in the dashboard banner.</div>
            </div>
            <input
              className="input time"
              type="time"
              value={state.policy.officialEnd}
              onChange={(e) => savePolicy({ officialEnd: e.target.value })}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Breaks count toward 8 hours</div>
              <div className="setting-desc">Default off — matches company policy.</div>
            </div>
            <Toggle
              value={state.policy.breakCountsAgainst}
              onChange={(v) => savePolicy({ breakCountsAgainst: v })}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Theme</div>
            </div>
            <select
              className="select"
              value={state.policy.theme}
              onChange={(e) =>
                savePolicy({ theme: e.target.value as "dark" | "light" })
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Data</div>
          <p style={{ fontSize: 13, marginBottom: 16 }}>
            Your work hours sync securely to your account. Export a backup any time,
            or wipe your data and start fresh.
          </p>
          <div className="btn-row">
            <button className="btn" onClick={exportJSON} type="button">
              Export JSON
            </button>
            <button
              className="btn"
              onClick={() => fileRef.current?.click()}
              type="button"
              title="Coming soon"
              disabled
            >
              Import JSON
            </button>
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              ref={fileRef}
            />
            <button className="btn danger" onClick={clearAll} disabled={isPending}>
              Clear all data
            </button>
          </div>
          <hr />
          <div className="tiny" style={{ marginBottom: 8 }}>
            QUICK STATS
          </div>
          <div className="row" style={{ gap: 24 }}>
            <div>
              <div className="tiny">DAYS</div>
              <div className="mono" style={{ fontSize: 16 }}>
                {Object.keys(state.sessions).length}
              </div>
            </div>
            <div>
              <div className="tiny">PLANS</div>
              <div className="mono" style={{ fontSize: 16 }}>
                {Object.keys(state.plans).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Message phrases
          <span className="meta">how your team writes each event</span>
        </div>
        <p style={{ fontSize: 13, marginBottom: 14 }}>
          Add the exact phrases you or your teammates type in Discord for each event.
          The importer will match these first, so any writing style works —{" "}
          <span className="mono" style={{ color: "var(--text)" }}>
            &ldquo;Logging In&rdquo;
          </span>
          ,{" "}
          <span className="mono" style={{ color: "var(--text)" }}>
            &ldquo;Starting my day&rdquo;
          </span>
          ,{" "}
          <span className="mono" style={{ color: "var(--text)" }}>
            &ldquo;GM team&rdquo;
          </span>
          , whatever your convention is. Matching is case-insensitive and ignores
          punctuation.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {(
            [
              { id: "in" as EventKind, label: "Log in", desc: "Start of day messages" },
              { id: "break" as EventKind, label: "Start break", desc: "Going afk / lunch / break" },
              { id: "resume" as EventKind, label: "Resume work", desc: "Back from break messages" },
              { id: "out" as EventKind, label: "Log out", desc: "End of day messages" },
            ]
          ).map((k) => (
            <PhraseEditor
              key={k.id}
              kindLabel={k.label}
              kindDesc={k.desc}
              phrases={state.policy.phrases?.[k.id] || []}
              onChange={(arr) =>
                savePolicy({ phrases: { ...state.policy.phrases, [k.id]: arr } })
              }
            />
          ))}
        </div>
        <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
          <span className="small">Changes apply immediately to any future imports.</span>
          <button
            className="btn ghost"
            onClick={() => savePolicy({ phrases: DEFAULT_PHRASES })}
            type="button"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Import from Discord
          <span className="meta">paste months of messages at once</span>
        </div>
        <p style={{ fontSize: 13, marginBottom: 14 }}>
          Copy messages from your admin Discord channel (Ctrl+A inside the channel,
          then Ctrl+C). Paste or drop a{" "}
          <span className="mono" style={{ color: "var(--text)" }}>
            .txt
          </span>{" "}
          file below — Carryover will pair each timestamp header with the next{" "}
          <span className="mono" style={{ color: "var(--text)" }}>
            Logging In / Taking a Break / Im Back / Logging Out
          </span>{" "}
          message and group everything by date automatically.
        </p>

        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <button className="btn" onClick={() => onPaste(sample)} type="button">
            Try sample
          </button>
          <label className="btn" style={{ cursor: "pointer" }}>
            Upload .txt file
            <input
              type="file"
              accept=".txt,text/plain"
              style={{ display: "none" }}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          <div style={{ flex: 1 }} />
          <div className="row" style={{ gap: 6 }}>
            <span className="tiny">CONFLICTS:</span>
            <button
              className={`btn ${mergeMode === "replace" ? "primary" : "ghost"}`}
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => setMergeMode("replace")}
              type="button"
            >
              Replace
            </button>
            <button
              className={`btn ${mergeMode === "merge" ? "primary" : "ghost"}`}
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => setMergeMode("merge")}
              type="button"
            >
              Merge
            </button>
          </div>
        </div>

        <textarea
          className="input"
          placeholder={sample}
          value={pasteText}
          onChange={(e) => onPaste(e.target.value)}
        />

        {parsed && (
          <div style={{ marginTop: 16 }}>
            <div
              className="row"
              style={{ justifyContent: "space-between", marginBottom: 10 }}
            >
              <div className="row" style={{ gap: 16 }}>
                <div>
                  <div className="tiny">EVENTS PARSED</div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 18,
                      color: parsed.events.length ? "var(--text)" : "var(--debit)",
                    }}
                  >
                    {parsed.events.length}
                  </div>
                </div>
                <div>
                  <div className="tiny">DAYS</div>
                  <div className="mono" style={{ fontSize: 18 }}>
                    {previewDays.length}
                  </div>
                </div>
                <div>
                  <div className="tiny">NET DELTA</div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 18,
                      color: totalDelta >= 0 ? "var(--credit)" : "var(--debit)",
                    }}
                  >
                    {totalDelta >= 0 ? "+" : "−"}
                    {fmtHMCompact(Math.abs(totalDelta))}
                  </div>
                </div>
                {parsed.unparsed.length > 0 && (
                  <div>
                    <div className="tiny">UNPARSED</div>
                    <div
                      className="mono"
                      style={{ fontSize: 18, color: "var(--debit)" }}
                    >
                      {parsed.unparsed.length}
                    </div>
                  </div>
                )}
              </div>
              <button
                className="btn primary lg"
                onClick={doImport}
                disabled={!parsed.events.length || isPending}
              >
                Import {previewDays.length} day{previewDays.length === 1 ? "" : "s"}
              </button>
            </div>

            {previewDays.length > 0 && (
              <div
                className="scroll"
                style={{
                  maxHeight: 340,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <table className="hist-table" style={{ margin: 0 }}>
                  <thead
                    style={{ position: "sticky", top: 0, background: "var(--bg-elev)" }}
                  >
                    <tr>
                      <th>Date</th>
                      <th>Events</th>
                      <th>In → Out</th>
                      <th>Worked</th>
                      <th>Breaks</th>
                      <th style={{ textAlign: "right" }}>Delta</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewDays.map((d) => {
                      const conflict = !!state.sessions[d.key];
                      return (
                        <tr key={d.key}>
                          <td className="name">{fmtDayKey(d.key)}</td>
                          <td>{d.events.length}</td>
                          <td>
                            {d.loginTs ? fmtTime(d.loginTs) : "—"} →{" "}
                            {d.logoutTs ? (
                              fmtTime(d.logoutTs)
                            ) : (
                              <span style={{ color: "var(--debit)" }}>open</span>
                            )}
                          </td>
                          <td>{fmtHMCompact(d.workedMs)}</td>
                          <td>{fmtHMCompact(d.breakMs)}</td>
                          <td
                            className={d.delta >= 0 ? "credit" : "debit"}
                            style={{ textAlign: "right" }}
                          >
                            {d.delta >= 0 ? "+" : "−"}
                            {fmtHMCompact(Math.abs(d.delta))}
                          </td>
                          <td>
                            {conflict ? (
                              <span className="tag debit">{mergeMode}</span>
                            ) : (
                              <span className="tag">new</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {parsed.unparsed.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary className="tiny" style={{ cursor: "pointer" }}>
                  SHOW {parsed.unparsed.length} UNPARSED LINES
                </summary>
                <div
                  className="scroll"
                  style={{
                    maxHeight: 160,
                    marginTop: 8,
                    padding: 10,
                    background: "var(--bg-elev-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {parsed.unparsed.map((l, i) => (
                    <div
                      key={i}
                      className="mono tiny"
                      style={{ padding: "2px 0" }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
