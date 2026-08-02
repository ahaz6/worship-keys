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

  /** Applies a host-reported state change and bumps the revision. */
  applyHostState(patch: Partial<LiveSessionSnapshot>): LiveSessionSnapshot {
    const transcript = patch.transcript ? patch.transcript.slice(-TRANSCRIPT_WINDOW) : this.snapshot.transcript;
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      // These four are owned by the server, never by a client patch.
      sessionId: this.snapshot.sessionId,
      transcript,
      revision: this.snapshot.revision + 1,
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
    return this.applyHostState({ remoteControlLocked: locked });
  }

  /* --------------------------------------------------------------- devices */

  get newJoinsLocked(): boolean {
    return this.joinsLocked;
  }

  setJoinsLocked(locked: boolean): void {
    this.joinsLocked = locked;
  }

  get pin(): string {
    return this.leaderPin;
  }

  /** Rotating the PIN also drops the current leader. */
  rotatePin(): string {
    this.leaderPin = generateLeaderPin();
    this.leaderPinHash = hashPin(this.leaderPin);
    this.leaderLease = null;
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
    if (!verifyPin(pin, this.leaderPinHash)) return { status: "rejected", reason: "That leader PIN is not correct." };

    const outcome = requestLeader(this.leaderLease, deviceId, this.now(), {
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

    if (expectedRevision !== this.snapshot.revision) {
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
