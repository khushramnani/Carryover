import { fmtTime } from "@/lib/time";
import type { EventKind, WorkEvent } from "@/lib/types";

const LABEL_MAP: Record<EventKind, string> = {
  in: "Logged in",
  out: "Logged out",
  break: "Started break",
  resume: "Resumed work",
};

const SHORT_MAP: Record<EventKind, string> = {
  in: "IN",
  out: "OUT",
  break: "BRK",
  resume: "RES",
};

const CLS_MAP: Record<EventKind, string> = {
  in: "in",
  out: "out",
  break: "brk",
  resume: "res",
};

export function EventIcon({ kind }: { kind: EventKind }) {
  return <span className={`event-icon ${CLS_MAP[kind]}`}>{SHORT_MAP[kind]}</span>;
}

interface EventRowProps {
  event: WorkEvent;
  onDelete?: (id: string) => void;
}

export function EventRow({ event, onDelete }: EventRowProps) {
  return (
    <div className="event-row">
      <span className="event-time">{fmtTime(event.ts)}</span>
      <EventIcon kind={event.kind} />
      <span className="event-label">{LABEL_MAP[event.kind]}</span>
      {onDelete && (
        <button className="event-del" onClick={() => onDelete(event.id)}>
          remove
        </button>
      )}
    </div>
  );
}
