import type { EventKind } from "./types";

export type PhraseBank = Record<EventKind, string[]>;

export const DEFAULT_PHRASES: PhraseBank = {
  in: [
    "logging in",
    "logged in",
    "clocking in",
    "starting work",
    "starting day",
    "start of day",
  ],
  out: [
    "logging out",
    "logged out",
    "clocking out",
    "signing off",
    "wrapping up",
    "done for today",
    "end of day",
    "ending day",
  ],
  break: [
    "taking a break",
    "on break",
    "starting break",
    "going on break",
    "brb",
    "afk",
    "lunch",
    "stepping out",
    "stepping away",
  ],
  resume: [
    "im back",
    "i'm back",
    "back",
    "resuming",
    "resumed",
    "returning",
    "returned",
    "end of break",
  ],
};
