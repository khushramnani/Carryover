export type EventKind = "in" | "out" | "break" | "resume";

export interface WorkEvent {
  id: string;
  ts: number;
  kind: EventKind;
  raw?: string | null;
}

export interface DaySession {
  events: WorkEvent[];
  closed: boolean;
}

export interface Plan {
  id: string;
  dayKey: string;
  preset: string;
  presetTitle: string;
  costMs: number;
  note: string | null;
  applied: boolean;
  createdAt: number;
}

export interface Policy {
  requiredMs: number;
  officialStart: string;
  officialEnd: string;
  breakCountsAgainst: boolean;
  theme: "dark" | "light";
  phrases: Record<EventKind, string[]>;
}

export interface AppState {
  policy: Policy;
  sessions: Record<string, DaySession>;
  plans: Record<string, Plan>;
}
