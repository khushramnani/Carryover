// Test-user mode: explore the whole app without Discord. The cookie only lets a
// visitor past the sign-in redirect — the server hands them an empty state and
// never touches the database for them; everything they do lives in their own
// browser's localStorage (components/demo-provider.tsx). Nothing real is exposed.

export const DEMO_COOKIE = "carryover_demo";

/** Set NEXT_PUBLIC_DEMO_MODE=1 to show the "Try as test user" button. */
export function demoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}
