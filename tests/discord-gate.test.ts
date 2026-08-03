import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { isBetaAllowed, verifyDiscordSignature } from "../lib/discord-gate";

// Stand in for Discord: an Ed25519 keypair whose public half is handed to us as
// raw hex, exactly like DISCORD_PUBLIC_KEY.
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyHex = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(12) // strip the SPKI header, leaving the raw 32-byte key
  .toString("hex");

const signAs = (timestamp: string, body: string) =>
  sign(null, Buffer.from(timestamp + body, "utf8"), privateKey).toString("hex");

describe("verifyDiscordSignature", () => {
  const ts = "1754200000";
  const body = JSON.stringify({ type: 1 });

  it("accepts a genuine signature over timestamp + body", () => {
    expect(verifyDiscordSignature(body, signAs(ts, body), ts, publicKeyHex)).toBe(true);
  });

  it("rejects a tampered body (this is the whole point)", () => {
    const sig = signAs(ts, body);
    expect(
      verifyDiscordSignature(JSON.stringify({ type: 2 }), sig, ts, publicKeyHex),
    ).toBe(false);
  });

  it("rejects a replayed signature under a different timestamp", () => {
    expect(verifyDiscordSignature(body, signAs(ts, body), "1754200001", publicKeyHex)).toBe(
      false,
    );
  });

  it("rejects a signature from the wrong key", () => {
    const other = generateKeyPairSync("ed25519");
    const sig = sign(null, Buffer.from(ts + body, "utf8"), other.privateKey).toString("hex");
    expect(verifyDiscordSignature(body, sig, ts, publicKeyHex)).toBe(false);
  });

  it("rejects garbage Discord sends while probing the endpoint", () => {
    for (const sig of ["", "deadbeef", "zz".repeat(64), "00".repeat(64)]) {
      expect(verifyDiscordSignature(body, sig, ts, publicKeyHex)).toBe(false);
    }
  });

  it("rejects missing headers or an unset public key", () => {
    const sig = signAs(ts, body);
    expect(verifyDiscordSignature(body, null, ts, publicKeyHex)).toBe(false);
    expect(verifyDiscordSignature(body, sig, null, publicKeyHex)).toBe(false);
    expect(verifyDiscordSignature(body, sig, ts, undefined)).toBe(false);
    expect(verifyDiscordSignature(body, sig, ts, "not-hex")).toBe(false);
  });

  it("survives being called twice with different keys (cache must not stick)", () => {
    const other = generateKeyPairSync("ed25519");
    const otherHex = other.publicKey
      .export({ format: "der", type: "spki" })
      .subarray(12)
      .toString("hex");
    const otherSig = sign(null, Buffer.from(ts + body, "utf8"), other.privateKey).toString(
      "hex",
    );

    expect(verifyDiscordSignature(body, signAs(ts, body), ts, publicKeyHex)).toBe(true);
    expect(verifyDiscordSignature(body, otherSig, ts, otherHex)).toBe(true);
    expect(verifyDiscordSignature(body, signAs(ts, body), ts, publicKeyHex)).toBe(true);
  });
});

describe("isBetaAllowed", () => {
  const original = process.env.BETA_DISCORD_USER_IDS;
  afterEach(() => {
    if (original === undefined) delete process.env.BETA_DISCORD_USER_IDS;
    else process.env.BETA_DISCORD_USER_IDS = original;
  });

  it("is open when the allowlist is unset or blank (production)", () => {
    delete process.env.BETA_DISCORD_USER_IDS;
    expect(isBetaAllowed("123")).toBe(true);
    expect(isBetaAllowed(null)).toBe(true);
    process.env.BETA_DISCORD_USER_IDS = "  ";
    expect(isBetaAllowed("123")).toBe(true);
  });

  it("admits only listed ids, tolerating spaces and trailing commas", () => {
    process.env.BETA_DISCORD_USER_IDS = " 123 , 456,";
    expect(isBetaAllowed("123")).toBe(true);
    expect(isBetaAllowed("456")).toBe(true);
    expect(isBetaAllowed("789")).toBe(false);
    expect(isBetaAllowed(null)).toBe(false);
  });

  it("does not match on a prefix of a snowflake", () => {
    process.env.BETA_DISCORD_USER_IDS = "123456789012345678";
    expect(isBetaAllowed("12345678901234567")).toBe(false);
  });
});
