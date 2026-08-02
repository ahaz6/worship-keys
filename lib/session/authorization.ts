/**
 * Session authorization (spec 18.10).
 *
 * A local network is not a trust boundary. Being on the same Wi-Fi grants a
 * device nothing: every mutating action is checked against a role the server
 * assigned, tokens are random and revocable, and the leader PIN is only ever
 * stored as a salted hash for the lifetime of the session.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { SessionRole } from "./protocol.ts";

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

/** Six digits, easy to read aloud across a stage. */
export function generateLeaderPin(): string {
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export type HashedPin = { hash: string; salt: string };

export function hashPin(pin: string): HashedPin {
  const salt = randomBytes(16).toString("hex");
  return { hash: createHash("sha256").update(`${salt}:${pin}`).digest("hex"), salt };
}

export function verifyPin(pin: string, hashed: HashedPin): boolean {
  const candidate = createHash("sha256").update(`${hashed.salt}:${pin}`).digest();
  const expected = Buffer.from(hashed.hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/**
 * Requests coming from the machine the host is running on. The host bootstrap
 * token is only ever handed to a loopback caller, so an iPad on the LAN cannot
 * obtain host privileges by guessing a URL.
 */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalised = address.replace(/^::ffff:/, "");
  return normalised === "127.0.0.1" || normalised === "::1" || normalised === "localhost";
}

/** Single source of truth for what each role may do. */
export function canRunLeaderCommand(role: SessionRole, remoteControlLocked: boolean): { allowed: boolean; reason: string | null } {
  if (role === "host") return { allowed: true, reason: null };
  if (role === "viewer") return { allowed: false, reason: "This device is view only." };
  if (remoteControlLocked) return { allowed: false, reason: "Remote control is locked by the host." };
  return { allowed: true, reason: null };
}

export function canRunHostCommand(role: SessionRole): { allowed: boolean; reason: string | null } {
  if (role === "host") return { allowed: true, reason: null };
  return { allowed: false, reason: "Only the host can change session settings." };
}

/**
 * Leader lease. One active leader is the safe default; a second device asking
 * for the role never takes over silently.
 */
export type LeaderLease = {
  deviceId: string;
  grantedAt: number;
};

export type LeaderRequestOutcome =
  | { status: "granted"; lease: LeaderLease }
  | { status: "needs-host-approval"; heldBy: string }
  | { status: "rejected"; reason: string };

export function requestLeader(
  current: LeaderLease | null,
  deviceId: string,
  now: number,
  options: { allowMultipleLeaders: boolean },
): LeaderRequestOutcome {
  if (current && current.deviceId === deviceId) return { status: "granted", lease: current };
  if (current && !options.allowMultipleLeaders) {
    return { status: "needs-host-approval", heldBy: current.deviceId };
  }
  return { status: "granted", lease: { deviceId, grantedAt: now } };
}
