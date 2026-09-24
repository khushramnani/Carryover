import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Force a non-IST zone so the day-boundary tests actually exercise the
    // fixed-offset math instead of accidentally passing on an IST laptop.
    env: { TZ: "UTC" },
    include: ["tests/**/*.test.ts"],
  },
});
