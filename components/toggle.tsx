"use client";

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  "aria-label"?: string;
}

export function Toggle({ value, onChange, "aria-label": ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      className={`toggle ${value ? "on" : ""}`}
      onClick={() => onChange(!value)}
    />
  );
}
