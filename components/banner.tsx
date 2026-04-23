import type { ReactNode } from "react";

interface BannerProps {
  tone?: "" | "credit" | "debit";
  eyebrow: string;
  main: string;
  hint?: string;
  action?: ReactNode;
}

export function Banner({ tone = "", eyebrow, main, hint, action }: BannerProps) {
  return (
    <div className={`banner ${tone}`}>
      <div className="banner-text">
        <div className="banner-eyebrow">{eyebrow}</div>
        <div className="banner-main mono">{main}</div>
        {hint && <div className="banner-hint">{hint}</div>}
      </div>
      {action}
    </div>
  );
}
