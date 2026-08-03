/**
 * Canonical live session state (spec 18.5 - 18.9).
 *
 * The store is the single authority. It holds the snapshot, the revision
 * counter, the set of connected devices, and the leader lease. It is
 * deliberately transport-free so the whole authorization and revision model can
 * be tested without opening a socket.
 */

import {
  type HashedPin,
  type LeaderLease,
  canRunLeaderCommand,
  generateLeaderPin,
  hashPin,
  randomToken,
  requestLeader,
  verifyPin,
} from "./authorization.ts";
import {
  type ConnectedDevice,
  type LeaderCommand,
  type LiveSessionSnapshot,
  type SessionRole,
  TRANSCRIPT_WINDOW,
  type TranscriptSegment,
  createEmptySnapshot,
} from "./protocol.ts";

export type DeviceRecord = ConnectedDevice & {
  /** Per-device token issued at join. Revoking a device invalidates it. */
  token: string;
};

export type CommandOutcome =
  | { status: "forward"; messageId: string; command: LeaderCommand }
  | { status: "duplicate"; revision: number }
  | { status: "stale"; revision: number }
  | { status: "denied"; reason: string };

export type SessionOptions = {
  sessionName?: string;
  allowMultipleLeaders?: boolean;
  /** Injectable for tests. */
  now?: () => number;
};

/** How many processed message ids to remember for idempotency. */
const SEEN_MESSAGE_LIMIT = 512;
const PIN_ATTEMPT_LIMIT = 5;
const PIN_ATTEMPT_WINDOW_MS = 60_000;
const PIN_LOCK_MS = 60_000;

export class SessionStore {
  readonly sessionId = randomToken(9);
  /** Handed to the host page over loopback only. */
  readonly hostToken = randomToken(32);
  /** Embedded in the QR code; grants viewer access only. */
  readonly viewerToken = randomToken(18);

  private leaderPin = generateLeaderPin();
  private leaderPinHash: HashedPin;
  private snapshot: LiveSessionSnapshot;
  private readonly devices = new Map<string, DeviceRecord>();
  private readonly seenMessages = new Set<string>();
  private leaderLease: LeaderLease | null = null;
  private joinsLocked = false;
  private readonly pinAttempts = new Map<string, { count: number; windowStartedAt: number; lockedUntil: number }>();
  private readonly allowMultipleLeaders: boolean;
  private readonly now: () => number;

  constructor(options: SessionOptions = {}) {
    this.allowMultipleLeaders = options.allowMultipleLeaders ?? false;
    this.now = options.now ?? (() => Date.now());
    this.leaderPinHash = hashPin(this.leaderPin);
    this.snapshot = createEmptySnapshot(this.sessionId, options.sessionName ?? "Sunday Morning");
  }

  /* ------------------------------------------------------------- snapshot */

  getSnapshot(): LiveSessionSnapshot {
    return { ...this.snapshot, serverTime: this.now() };
  }

  get revision(): number {
    return this.snapshot.revision;
  }

  /** Applies host state and advances the semantic command revision when needed. */
  applyHostState(patch: Partial<LiveSessionSnapshot>): LiveSessionSnapshot {
    const transcript = patch.transcript ? patch.transcript.slice(-TRANSCRIPT_WINDOW) : this.snapshot.transcript;
    const telemetryKeys = new Set<keyof LiveSessionSnapshot>(["padProgress", "crossfading", "crescendoActive"]);
    const patchKeys = Object.keys(patch) as Array<keyof LiveSessionSnapshot>;
    // Animation frames do not change command semantics. Keeping their revision
    // stable prevents a leader click from becoming stale merely because a fade
    // progress packet arrived at the same moment.
    const telemetryOnly = patchKeys.length > 0 && patchKeys.every((key) => telemetryKeys.has(key));
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      // These four are owned by the server, never by a client patch.
      sessionId: this.snapshot.sessionId,
      transcript,
      remoteControlLocked: this.snapshot.remoteControlLocked,
      joinsLocked: this.snapshot.joinsLocked,
      revision: this.snapshot.revision + (telemetryOnly ? 0 : 1),
      serverTime: this.now(),
    };
    return this.snapshot;
  }

  appendTranscript(segment: TranscriptSegment): LiveSessionSnapshot {
    const transcript = [...this.snapshot.transcript.filter((entry) => entry.id !== segment.id), segment].slice(
      -TRANSCRIPT_WINDOW,
    );
    return this.applyHostState({ transcript });
  }

  setHostOnline(online: boolean): LiveSessionSnapshot {
    return this.applyHostState({ hostOnline: online });
  }

  setRemoteControlLocked(locked: boolean): LiveSessionSnapshot {
    this.snapshot = { ...this.snapshot, remoteControlLocked: locked };
    return this.applyHostState({});
  }

  /* --------------------------------------------------------------- devices */

  get newJoinsLocked(): boolean {
    return this.joinsLocked;
  }

  setJoinsLocked(locked: boolean): void {
    this.joinsLocked = locked;
    this.snapshot = { ...this.snapshot, joinsLocked: locked };
    this.applyHostState({});
  }

  get pin(): string {
    return this.leaderPin;
  }

  /** Rotating the PIN also drops the current leader. */
  rotatePin(): string {
    this.leaderPin = generateLeaderPin();
    this.leaderPinHash = hashPin(this.leaderPin);
    this.leaderLease = null;
    this.pinAttempts.clear();
    for (const device of this.devices.values()) {
      if (device.role === "leader") device.role = "viewer";
    }
    return this.leaderPin;
  }

  /**
   * Registers a joining device. A correct viewer token buys exactly one thing:
   * the viewer role. Nothing else is granted here.
   */
  join(token: string, deviceName: string): { deviceId: string; role: SessionRole; token: string } | { error: string } {
    if (token === this.hostToken) {
      const deviceId = "host";
      const record: DeviceRecord = {
        deviceId,
        role: "host",
        name: deviceName || "Host",
        lastSeen: this.now(),
        leaderRequested: false,
        token,
      };
      this.devices.set(deviceId, record);
      return { deviceId, role: "host", token };
    }

    if (token !== this.viewerToken) {
      // An already-issued device token lets a reconnecting iPad keep its role.
      const existing = [...this.devices.values()].find((device) => device.token === token);
      if (existing) {
        existing.lastSeen = this.now();
        if (deviceName.trim()) existing.name = deviceName.trim();
        return { deviceId: existing.deviceId, role: existing.role, token: existing.token };
      }
      return { error: "This join link is no longer valid. Scan the QR code again." };
    }

    if (this.joinsLocked) return { error: "The host has locked new devices for this session." };

    const deviceId = randomToken(8);
    const record: DeviceRecord = {
      deviceId,
      role: "viewer",
      name: deviceName || "Musician iPad",
      lastSeen: this.now(),
      leaderRequested: false,
      token: randomToken(24),
    };
    this.devices.set(deviceId, record);
    return { deviceId, role: "viewer", token: record.token };
  }

  touch(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) device.lastSeen = this.now();
  }

  getDevice(deviceId: string): DeviceRecord | null {
    return this.devices.get(deviceId) ?? null;
  }

  listDevices(): ConnectedDevice[] {
    return [...this.devices.values()].map(({ token: _token, ...device }) => device);
  }

  removeDevice(deviceId: string): void {
    if (this.leaderLease?.deviceId === deviceId) this.leaderLease = null;
    this.devices.delete(deviceId);
  }

  /* ---------------------------------------------------------------- leader */

  /** A device offering the PIN. Never an automatic takeover from a sitting leader. */
  requestLeaderRole(deviceId: string, pin: string): { status: "granted" | "needs-host-approval" | "rejected"; reason?: string } {
    const device = this.devices.get(deviceId);
    if (!device) return { status: "rejected", reason: "Unknown device." };
    const now = this.now();
    const attempt = this.pinAttempts.get(deviceId);
    if (attempt && attempt.lockedUntil > now) {
      return { status: "rejected", reason: "Too many incorrect attempts. Wait one minute and try again." };
    }
    if (!verifyPin(pin, this.leaderPinHash)) {
      const current = !attempt || now - attempt.windowStartedAt >= PIN_ATTEMPT_WINDOW_MS
        ? { count: 0, windowStartedAt: now, lockedUntil: 0 }
        : attempt;
      current.count += 1;
      if (current.count >= PIN_ATTEMPT_LIMIT) current.lockedUntil = now + PIN_LOCK_MS;
      this.pinAttempts.set(deviceId, current);
      return {
        status: "rejected",
        reason: current.lockedUntil > now
          ? "Too many incorrect attempts. Wait one minute and try again."
          : "That leader PIN is not correct.",
      };
    }
    this.pinAttempts.delete(deviceId);

    const outcome = requestLeader(this.leaderLease, deviceId, now, {
      allowMultipleLeaders: this.allowMultipleLeaders,
    });

    if (outcome.status === "granted") {
      this.leaderLease = outcome.lease;
      device.role = "leader";
      device.leaderRequested = false;
      return { status: "granted" };
    }
    if (outcome.status === "needs-host-approval") {
      device.leaderRequested = true;
      return { status: "needs-host-approval", reason: "Another device is already the leader. The host must confirm." };
    }
    return { status: "rejected", reason: outcome.reason };
  }

  /** The host resolving a pending handover, or demoting a leader. */
  setLeaderApproval(deviceId: string, approved: boolean): { ok: boolean; demoted: string | null } {
    const device = this.devices.get(deviceId);
    if (!device) return { ok: false, demoted: null };
    if (!approved) {
      device.leaderRequested = false;
      if (device.role === "leader") {
        device.role = "viewer";
        if (this.leaderLease?.deviceId === deviceId) this.leaderLease = null;
      }
      return { ok: true, demoted: null };
    }

    let demoted: string | null = null;
    if (this.leaderLease && this.leaderLease.deviceId !== deviceId && !this.allowMultipleLeaders) {
      const previous = this.devices.get(this.leaderLease.deviceId);
      if (previous) {
        previous.role = "viewer";
        demoted = previous.deviceId;
      }
    }
    device.role = "leader";
    device.leaderRequested = false;
    this.leaderLease = { deviceId, grantedAt: this.now() };
    return { ok: true, demoted };
  }

  get currentLeaderId(): string | null {
    return this.leaderLease?.deviceId ?? null;
  }

  /* -------------------------------------------------------------- commands */

  /**
   * Validates a leader command. Nothing is applied here — the host runs the
   * audio action first and the store only advances once it acknowledges.
   */
  evaluateCommand(deviceId: string, messageId: string, expectedRevision: number, command: LeaderCommand): CommandOutcome {
    if (this.seenMessages.has(messageId)) return { status: "duplicate", revision: this.snapshot.revision };

    const device = this.devices.get(deviceId);
    if (!device) return { status: "denied", reason: "This device is not part of the session." };

    const permission = canRunLeaderCommand(device.role, this.snapshot.remoteControlLocked);
    if (!permission.allowed) return { status: "denied", reason: permission.reason ?? "Not allowed." };

    if (device.role === "leader" && this.leaderLease?.deviceId !== deviceId) {
      return { status: "denied", reason: "Leader access has moved to another device." };
    }

    // Live sound controls carry absolute values, not relative edits. They are
    // safe to apply against a newer chord/snapshot revision and must remain
    // fluid while the host is publishing MIDI detection updates.
    const isAbsoluteSoundControl =
      command.type === "set-pad-settings" || command.type === "set-muted" || command.type === "set-bpm";
    if (expectedRevision !== this.snapshot.revision && !isAbsoluteSoundControl) {
      return { status: "stale", revision: this.snapshot.revision };
    }

    if (!this.snapshot.hostOnline) {
      return { status: "denied", reason: "The host is offline. Command not applied." };
    }

    this.rememberMessage(messageId);
    return { status: "forward", messageId, command };
  }

  private rememberMessage(messageId: string): void {
    this.seenMessages.add(messageId);
    if (this.seenMessages.size > SEEN_MESSAGE_LIMIT) {
      const oldest = this.seenMessages.values().next().value;
      if (oldest) this.seenMessages.delete(oldest);
    }
  }

  hasSeenMessage(messageId: string): boolean {
    return this.seenMessages.has(messageId);
  }
}
