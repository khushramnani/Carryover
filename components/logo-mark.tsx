interface LogoMarkProps {
  size?: number;
  radius?: number;
}

export function LogoMark({ size = 28, radius = 7 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{
        display: "block",
        borderRadius: radius,
        background: "var(--text)",
        color: "var(--text)",
      }}
    >
      <g
        stroke="var(--bg)"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <circle cx="26" cy="34" r="13" strokeWidth="3.5" opacity="0.35" />
        <path d="M26 24 V34 L34 38" strokeWidth="3.5" />
        <path d="M42 14 C52 22, 52 42, 42 50" strokeWidth="4.5" />
        <path d="M38 46 L42 50 L46 46" strokeWidth="4.5" />
      </g>
    </svg>
  );
}
