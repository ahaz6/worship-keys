import type { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/lib/supabase/client";
import {
  HEARTBEAT_INTERVAL_MS,
  PROTOCOL_VERSION,
  type ConnectedDevice,
  type HostCommand,
  type LeaderCommand,
  type LiveSessionSnapshot,
  type ServerMessage,
  type SessionRole,
  createEmptySnapshot,
  leaderCommandSchema,
} from "@/lib/session/protocol";

import type { SessionConnectionEvents } from "./client";

export type CloudBootstrap = {
  sessionId: string;
  viewerToken: string;
  leaderPin: string;
};

type ClientEnvelope = {
  senderId: string;
  token?: string;
  deviceName?: string;
  deviceToken?: string;
  messageId?: string;
  expectedRevision?: number;
  pin?: string;
  command?: unknown;
};

type ServerEnvelope = { to?: string; message: ServerMessage };

type CloudDevice = ConnectedDevice & { token: string; senderId: string };

const TELEMETRY_KEYS = new Set<keyof LiveSessionSnapshot>(["padProgress", "crossfading", "crescendoActive"]);

function randomToken(bytes = 24): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, (value) => value.toString(16).padStart(2, "0")).join("");
}

function randomPin(): string {
  const data = new Uint32Array(1);
  crypto.getRandomValues(data);
  return String(data[0]! % 1_000_000).padStart(6, "0");
}

export function createCloudSessionBootstrap(): CloudBootstrap {
  return {
    sessionId: randomToken(12),
    viewerToken: randomToken(24),
    leaderPin: randomPin(),
  };
}

/**
 * Browser-owned live-session authority transported by Supabase Broadcast.
 * Audio and MIDI stay in the Vercel host tab; Supabase only carries compact
 * state and commands. The unguessable viewer token is both room capability and
 * join key, matching the security model of the former QR token.
 */
export class CloudSessionConnection {
  private channel: RealtimeChannel | null = null;
  private senderId = randomToken(10);
  private revision = 0;
  private role: SessionRole | null = null;
  private deviceToken: string | null = null;
  private bootstrap: CloudBootstrap | null = null;
  private snapshot: LiveSessionSnapshot | null = null;
  private devices = new Map<string, CloudDevice>();
  private pending = new Map<string, string>();
  private leaderDeviceId: string | null = null;
  private remoteLocked = false;
  private joinsLocked = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private subscribed = false;

  constructor(private readonly events: SessionConnectionEvents) {}

  setRevision(revision: number): void {
    this.revision = revision;
  }

  startHost(bootstrap: CloudBootstrap, sessionName = "Sunday Morning"): void {
    this.disconnect();
    this.bootstrap = bootstrap;
    this.role = "host";
    this.deviceToken = randomToken(24);
    this.snapshot = { ...createEmptySnapshot(bootstrap.sessionId, sessionName), hostOnline: true };
    const host: CloudDevice = {
      deviceId: "host",
      role: "host",
      name: "Host Browser",
      lastSeen: Date.now(),
      leaderRequested: false,
      token: this.deviceToken,
      senderId: this.senderId,
    };
    this.devices.set(host.deviceId, host);
    this.events.onMessage({
      type: "welcome",
      role: "host",
      deviceId: "host",
      deviceToken: this.deviceToken,
      snapshot: this.snapshot,
      protocol: PROTOCOL_VERSION,
    });
    this.openChannel();
  }

  connect(viewerToken: string, deviceName: string, deviceToken?: string | null): void {
    this.disconnect();
    this.bootstrap = { sessionId: viewerToken.slice(0, 24), viewerToken, leaderPin: "" };
    this.role = null;
    this.deviceToken = deviceToken ?? null;
    this.openChannel(() => {
      void this.sendClient("hello", {
        token: deviceToken ?? viewerToken,
        deviceName,
        deviceToken: deviceToken ?? undefined,
      });
    });
  }

  private openChannel(onSubscribed?: () => void): void {
    const supabase = getSupabaseClient();
    const bootstrap = this.bootstrap;
    if (!supabase || !bootstrap) {
      this.events.onStatus("closed");
      this.events.onMessage({ type: "error", message: "Cloud Live is not configured." });
      return;
    }
    this.events.onStatus("connecting");
    const channel = supabase.channel(`wk-live:${bootstrap.viewerToken}`, {
      config: { broadcast: { ack: true, self: false } },
    });
    this.channel = channel;
    channel
      .on("broadcast", { event: "client:hello" }, ({ payload }) => this.onHello(payload as ClientEnvelope))
      .on("broadcast", { event: "client:command" }, ({ payload }) => this.onCommand(payload as ClientEnvelope))
      .on("broadcast", { event: "client:leader" }, ({ payload }) => this.onLeaderRequest(payload as ClientEnvelope))
      .on("broadcast", { event: "server" }, ({ payload }) => this.onServer(payload as ServerEnvelope))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.subscribed = true;
          this.events.onStatus("connected");
          onSubscribed?.();
          if (this.role === "host") {
            this.broadcastSnapshot();
            this.broadcastDevices();
            this.heartbeat = setInterval(() => {
              if (!this.snapshot) return;
              void this.sendServer({
                type: "heartbeat",
                serverTime: Date.now(),
                revision: this.snapshot.revision,
                hostOnline: true,
              });
            }, HEARTBEAT_INTERVAL_MS);
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.events.onStatus("reconnecting");
        } else if (status === "CLOSED") {
          this.events.onStatus("closed");
        }
      });
  }

  private onServer(envelope: ServerEnvelope): void {
    if (!envelope?.message || (envelope.to && envelope.to !== this.senderId)) return;
    this.events.onMessage(envelope.message);
    if (envelope.message.type === "welcome") {
      this.role = envelope.message.role;
      this.deviceToken = envelope.message.deviceToken;
    } else if (envelope.message.type === "role-changed") {
      this.role = envelope.message.role;
    }
  }

  private onHello(envelope: ClientEnvelope): void {
    if (this.role !== "host" || !this.bootstrap || !this.snapshot || envelope.senderId === this.senderId) return;
    const existing = [...this.devices.values()].find((device) => device.token === envelope.token);
    if (!existing && envelope.token !== this.bootstrap.viewerToken) {
      void this.sendServer({ type: "error", message: "This join link is no longer valid. Scan the QR code again." }, envelope.senderId);
      return;
    }
    if (!existing && this.joinsLocked) {
      void this.sendServer({ type: "error", message: "The host has locked new devices for this session." }, envelope.senderId);
      return;
    }
    const device = existing ?? {
      deviceId: randomToken(8),
      role: "viewer" as const,
      name: envelope.deviceName?.trim() || "Musician device",
      lastSeen: Date.now(),
      leaderRequested: false,
      token: randomToken(24),
      senderId: envelope.senderId,
    };
    device.senderId = envelope.senderId;
    device.lastSeen = Date.now();
    if (envelope.deviceName?.trim()) device.name = envelope.deviceName.trim();
    this.devices.set(device.deviceId, device);
    void this.sendServer({
      type: "welcome",
      role: device.role,
      deviceId: device.deviceId,
      deviceToken: device.token,
      snapshot: this.snapshot,
      protocol: PROTOCOL_VERSION,
    }, envelope.senderId);
    this.broadcastDevices();
  }

  private onCommand(envelope: ClientEnvelope): void {
    if (this.role !== "host" || !this.snapshot || !envelope.messageId) return;
    const device = [...this.devices.values()].find(
      (entry) => entry.token === envelope.deviceToken && entry.senderId === envelope.senderId,
    );
    const parsed = leaderCommandSchema.safeParse(envelope.command);
    if (!device || !parsed.success || device.role !== "leader" || this.leaderDeviceId !== device.deviceId) {
      void this.sendAck(envelope, false, "This device is view only.");
      return;
    }
    if (this.remoteLocked) {
      void this.sendAck(envelope, false, "Remote control is locked by the host.");
      return;
    }
    const absolute = ["set-pad-settings", "set-muted", "set-bpm"].includes(parsed.data.type);
    if (!absolute && envelope.expectedRevision !== this.snapshot.revision) {
      void this.sendAck(envelope, false, "Your view was out of date. Try again.");
      void this.sendServer({ type: "snapshot", snapshot: this.snapshot }, envelope.senderId);
      return;
    }
    this.pending.set(envelope.messageId, envelope.senderId);
    this.events.onMessage({
      type: "run-command",
      messageId: envelope.messageId,
      command: parsed.data,
      fromDeviceId: device.deviceId,
    });
  }

  private onLeaderRequest(envelope: ClientEnvelope): void {
    if (this.role !== "host" || !this.bootstrap) return;
    const device = [...this.devices.values()].find(
      (entry) => entry.token === envelope.deviceToken && entry.senderId === envelope.senderId,
    );
    if (!device) return;
    if (envelope.pin !== this.bootstrap.leaderPin) {
      void this.sendServer({ type: "error", message: "That leader PIN is not correct." }, envelope.senderId);
      return;
    }
    if (this.leaderDeviceId && this.leaderDeviceId !== device.deviceId) {
      device.leaderRequested = true;
      void this.sendServer({ type: "error", message: "Another device is already the leader. The host must confirm." }, envelope.senderId);
      this.broadcastDevices();
      return;
    }
    this.setLeader(device.deviceId, true);
  }

  private setLeader(deviceId: string, approved: boolean): void {
    const target = this.devices.get(deviceId);
    if (!target) return;
    if (approved && this.leaderDeviceId && this.leaderDeviceId !== deviceId) {
      const previous = this.devices.get(this.leaderDeviceId);
      if (previous) {
        previous.role = "viewer";
        void this.sendServer({ type: "role-changed", role: "viewer", reason: "Leader access moved to another device." }, previous.senderId);
      }
    }
    target.role = approved ? "leader" : "viewer";
    target.leaderRequested = false;
    this.leaderDeviceId = approved ? deviceId : this.leaderDeviceId === deviceId ? null : this.leaderDeviceId;
    void this.sendServer({
      type: "role-changed",
      role: target.role,
      reason: approved ? "Leader access granted." : "Leader access was removed.",
    }, target.senderId);
    this.broadcastDevices();
  }

  private async sendClient(event: string, payload: Omit<ClientEnvelope, "senderId">): Promise<void> {
    if (!this.channel || !this.subscribed) return;
    await this.channel.send({ type: "broadcast", event: `client:${event}`, payload: { ...payload, senderId: this.senderId } });
  }

  private async sendServer(message: ServerMessage, to?: string): Promise<void> {
    if (!this.channel || !this.subscribed) return;
    await this.channel.send({ type: "broadcast", event: "server", payload: { to, message } satisfies ServerEnvelope });
  }

  private sendAck(envelope: ClientEnvelope, applied: boolean, reason?: string): void {
    if (!envelope.messageId || !this.snapshot) return;
    void this.sendServer({ type: "ack", messageId: envelope.messageId, applied, revision: this.snapshot.revision, reason }, envelope.senderId);
  }

  private broadcastSnapshot(): void {
    if (this.snapshot) void this.sendServer({ type: "snapshot", snapshot: this.snapshot });
  }

  private broadcastDevices(): void {
    const devices = [...this.devices.values()].map(({ token: _token, senderId: _senderId, ...device }) => device);
    this.events.onMessage({ type: "devices", devices });
  }

  sendCommand(command: LeaderCommand): string | null {
    if (!this.subscribed || !this.deviceToken) return null;
    const messageId = `msg-${Date.now().toString(36)}-${randomToken(4)}`;
    void this.sendClient("command", {
      deviceToken: this.deviceToken,
      messageId,
      expectedRevision: this.revision,
      command,
    });
    return messageId;
  }

  sendHostCommand(command: HostCommand): void {
    if (this.role !== "host" || !this.snapshot) return;
    if (command.type === "set-remote-lock") {
      this.remoteLocked = command.locked;
      this.snapshot = { ...this.snapshot, remoteControlLocked: command.locked, revision: this.snapshot.revision + 1 };
      this.broadcastSnapshot();
    } else if (command.type === "lock-new-joins") {
      this.joinsLocked = command.locked;
      this.snapshot = { ...this.snapshot, joinsLocked: command.locked, revision: this.snapshot.revision + 1 };
      this.broadcastSnapshot();
    } else if (command.type === "set-leader") {
      this.setLeader(command.deviceId, command.approved);
    } else if (command.type === "revoke-device") {
      const target = this.devices.get(command.deviceId);
      if (target) void this.sendServer({ type: "error", message: "This device was removed from the session." }, target.senderId);
      this.devices.delete(command.deviceId);
      if (this.leaderDeviceId === command.deviceId) this.leaderDeviceId = null;
      this.broadcastDevices();
    }
  }

  sendHostState(patch: Partial<LiveSessionSnapshot>): void {
    if (this.role !== "host" || !this.snapshot) return;
    const keys = Object.keys(patch) as Array<keyof LiveSessionSnapshot>;
    const telemetryOnly = keys.length > 0 && keys.every((key) => TELEMETRY_KEYS.has(key));
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      sessionId: this.snapshot.sessionId,
      remoteControlLocked: this.remoteLocked,
      joinsLocked: this.joinsLocked,
      revision: this.snapshot.revision + (telemetryOnly ? 0 : 1),
      serverTime: Date.now(),
    };
    this.revision = this.snapshot.revision;
    this.events.onMessage({ type: "snapshot", snapshot: this.snapshot });
    this.broadcastSnapshot();
  }

  acknowledge(messageId: string, applied: boolean, reason?: string): void {
    if (this.role !== "host" || !this.snapshot) return;
    const to = this.pending.get(messageId);
    if (!to) return;
    this.pending.delete(messageId);
    void this.sendServer({ type: "ack", messageId, applied, revision: this.snapshot.revision, reason }, to);
    this.broadcastSnapshot();
  }

  requestLeader(pin: string): void {
    if (!this.deviceToken) return;
    void this.sendClient("leader", { deviceToken: this.deviceToken, pin });
  }

  rotatePin(): string | null {
    if (this.role !== "host" || !this.bootstrap) return null;
    this.bootstrap.leaderPin = randomPin();
    if (this.leaderDeviceId) this.setLeader(this.leaderDeviceId, false);
    return this.bootstrap.leaderPin;
  }

  disconnect(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.subscribed = false;
    if (this.channel) void getSupabaseClient()?.removeChannel(this.channel);
    this.channel = null;
    this.events.onStatus("closed");
  }

  giveUp(): void {
    this.disconnect();
  }
}
