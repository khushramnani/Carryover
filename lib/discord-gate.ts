import { createPublicKey, verify, type KeyObject } from "node:crypto";

// Who is allowed to talk to us: Discord request authenticity + the private-beta
// allowlist. No secrets live here (the interaction public key is public and the
// allowlist is a list of user ids), so it stays importable from tests — unlike
// lib/discord-api.ts, which is server-only.

// DER prefix that turns a raw 32-byte Ed25519 public key into an SPKI blob.
// Lets us verify with node:crypto instead of pulling tweetnacl in via the
// discord-interactions package.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const HEX_PUBLIC_KEY = /^[0-9a-fA-F]{64}$/;
const HEX_SIGNATURE = /^[0-9a-fA-F]{128}$/;

let cachedKey: { hex: string; key: KeyObject } | null = null;

function publicKey(hex: string): KeyObject | null {
  if (!HEX_PUBLIC_KEY.test(hex)) return null;
  if (cachedKey?.hex === hex) return cachedKey.key;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(hex, "hex")]),
      format: "der",
      type: "spki",
    });
    cachedKey = { hex, key };
    return key;
  } catch {
    return null;
  }
}

/**
 * Verify a Discord interaction request. Discord signs `timestamp + rawBody`
 * with Ed25519 and probes the endpoint with deliberately bad signatures when
 * you save the URL — a handler that skips this never passes validation.
 */
export function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyHex: string | undefined,
): boolean {
  if (!signature || !timestamp || !publicKeyHex) return false;
  if (!HEX_SIGNATURE.test(signature)) return false;
  const key = publicKey(publicKeyHex);
  if (!key) return false;
  try {
    return verify(
      null,
      Buffer.from(timestamp + rawBody, "utf8"),
      key,
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * Private-beta allowlist, guarding both web sign-in and slash commands.
 * Unset/empty = gate off (production).
 */
export function isBetaAllowed(discordUserId: string | null | undefined): boolean {
  const raw = process.env.BETA_DISCORD_USER_IDS?.trim();
  if (!raw) return true;
  if (!discordUserId) return false;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(discordUserId);
}
