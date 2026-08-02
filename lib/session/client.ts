/**
 * Browser side of the live session socket.
 *
 * Reconnection lives here rather than inside a React hook: a socket that
 * reopens itself is an external system with its own lifecycle, and keeping that
 * out of the render cycle means a dropped Wi-Fi connection cannot turn into a
 * render loop.
 */

import type { HostCommand, LeaderCommand, LiveSessionSnapshot, ServerMessage } from "./protocol.ts";

const RECONNECT_DELAY_MS = 1200;

export type SessionConnectionEvents = {
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: "connecting" | "connected" | "reconnecting" | "closed") => void;
};

export class SessionConnection {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private deviceName = "Device";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wantsConnection = false;
  private revision = 0;

  constructor(private readonly events: SessionConnectionEvents) {}

  /** Latest revision seen, used as `expectedRevision` on outgoing commands. */
  setRevision(revision: number): void {
    this.revision = revision;
  }

  connect(token: string, deviceName: string): void {
    this.token = token;
    this.deviceName = deviceName;
    this.wantsConnection = true;
    this.open();
  }

  private open(): void {
    if (typeof window === "undefined" || !this.token) return;
    this.socket?.close();

    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${window.location.host}/session`);
    this.socket = socket;
    this.events.onStatus("connecting");

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "hello", token: this.token, deviceName: this.deviceName }));
    };

    socket.onmessage = (event) => {
      try {
        this.events.onMessage(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        // A malformed frame is dropped rather than allowed to break the session.
      }
    };

    socket.onclose = () => {
      this.socket = null;
      if (!this.wantsConnection) {
        this.events.onStatus("closed");
        return;
      }
      this.events.onStatus("reconnecting");
      this.reconnectTimer = setTimeout(() => this.open(), RECONNECT_DELAY_MS);
    };

    socket.onerror = () => socket.close();
  }

  /** Stops reconnecting; used when a token was rejected outright. */
  giveUp(): void {
    this.wantsConnection = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  disconnect(): void {
    this.giveUp();
    this.socket?.close();
    this.socket = null;
  }

  private send(payload: unknown): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }

  sendCommand(command: LeaderCommand): string | null {
    const messageId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const sent = this.send({ type: "command", messageId, expectedRevision: this.revision, command });
    return sent ? messageId : null;
  }

  sendHostCommand(command: HostCommand): void {
    this.send({
      type: "host-command",
      messageId: `host-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      command,
    });
  }

  sendHostState(patch: Partial<LiveSessionSnapshot>): void {
    this.send({ type: "host-state", patch });
  }

  acknowledge(messageId: string, applied: boolean, reason?: string): void {
    this.send({ type: "host-ack", messageId, applied, reason });
  }

  resync(): void {
    this.send({ type: "resync" });
  }
}
