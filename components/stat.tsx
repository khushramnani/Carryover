interface StatProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "" | "credit" | "debit";
}

export function Stat({ label, value, sub, tone = "" }: StatProps) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
