"use client";

import { useState } from "react";

interface PhraseEditorProps {
  kindLabel: string;
  kindDesc: string;
  phrases: string[];
  onChange: (phrases: string[]) => void;
}

export function PhraseEditor({
  kindLabel,
  kindDesc,
  phrases,
  onChange,
}: PhraseEditorProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (phrases.some((p) => p.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...phrases, v]);
    setDraft("");
  };

  const remove = (i: number) => onChange(phrases.filter((_, idx) => idx !== i));

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: 14,
        background: "var(--bg-elev-2)",
      }}
    >
      <div style={{ fontWeight: 500, fontSize: 13 }}>{kindLabel}</div>
      <div className="small" style={{ marginBottom: 10 }}>
        {kindDesc}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {phrases.length === 0 && (
          <span className="tiny">No phrases yet — add one below</span>
        )}
        {phrases.map((p, i) => (
          <span
            key={i}
            className="tag"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 4px 3px 10px",
            }}
          >
            {p}
            <button
              onClick={() => remove(i)}
              style={{
                color: "var(--text-faint)",
                padding: "0 6px",
                fontSize: 12,
                lineHeight: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              aria-label={`Remove "${p}"`}
              title="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="input"
          style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}
          placeholder='e.g. "Starting my day"'
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          className="btn"
          style={{ padding: "6px 12px", fontSize: 12 }}
          onClick={add}
          type="button"
        >
          Add
        </button>
      </div>
    </div>
  );
}
