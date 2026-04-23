import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-elev": "var(--bg-elev)",
        "bg-elev-2": "var(--bg-elev-2)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-dim": "var(--text-dim)",
        "text-faint": "var(--text-faint)",
        credit: "var(--credit)",
        "credit-bg": "var(--credit-bg)",
        debit: "var(--debit)",
        "debit-bg": "var(--debit-bg)",
        accent: "var(--accent)",
        "accent-bg": "var(--accent-bg)",
        danger: "var(--danger)",
      },
      fontFamily: {
        ui: "var(--font-ui)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      keyframes: {
        pulse: {
          "0%, 100%": {
            boxShadow: "0 0 0 0 color-mix(in srgb, var(--credit) 50%, transparent)",
          },
          "50%": {
            boxShadow: "0 0 0 8px color-mix(in srgb, var(--credit) 0%, transparent)",
          },
        },
      },
      animation: {
        "ring-pulse": "pulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
