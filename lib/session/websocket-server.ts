/**
 * Local live session transport (spec 18.5).
 *
 * A leader command travels: leader → server (role + revision checked) → host →
 * host performs the audio action → host acknowledges → server advances the
 * canonical revision → broadcast to everyone. The leader only sees a confirmed
 * key change after the host has actually made it, and a host that never answers
 * produces "Command not applied" rather than a lie.
 */

import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";

import { WebSocketServer, type WebSocket } from "ws";

import {
  type ClientMessage,
  HEARTBEAT_INTERVAL_MS,
  HOST_ACK_TIMEOUT_MS,
  PROTOCOL_VERSION,
  type ServerMessage,
  type SessionRole,
  clientMessageSchema,
} from "./protocol.ts";
import { SessionStore } from "./session-store.ts";
import { canRunHostCommand } from "./authorization.ts";

type Connection = {
  socket: WebSocket;
  deviceId: string | null;
  role: SessionRole | null;
};

type PendingCommand = {
  messageId: string;
  fromDeviceId: string;
  timer: NodeJS.Timeout;
};

export type SessionServer = {
  store: SessionStore;
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void;
  broadcastSnapshot(): void;
  close(): void;
};

export function createSessionServer(httpServer: HttpServer, store: SessionStore): SessionServer {
  const wss = new WebSocketServer({ noServer: true });
  const connections = new Set<Connection>();
  const pending = new Map<string, PendingCommand>();

  const send = (socket: WebSocket, message: ServerMessage): void => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };

  const broadcast = (message: ServerMessage, filter?: (connection: Connection) => boolean): void => {
    for (const connection of connections) {
      if (connection.deviceId == null) continue;
      if (filter && !filter(connection)) continue;
      send(connection.socket, message);
    }
  };

  const broadcastSnapshot = (): void => {
    broadcast({ type: "snapshot", snapshot: store.getSnapshot() });
  };

  const broadcastDevices = (): void => {
    broadcast({ type: "devices", devices: store.listDevices() }, (connection) => connection.role === "host");
  };

  const hostConnection = (): Connection | null =>
    [...connections].find((connection) => connection.role === "host") ?? null;

  const resolvePending = (messageId: string, applied: boolean, reason?: string): void => {
    const entry = pending.get(messageId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(messageId);
    const target = [...connections].find((connection) => connection.deviceId === entry.fromDeviceId);
    if (target) {
      send(target.socket, { type: "ack", messageId, applied, revision: store.revision, reason });
    }
  };

  wss.on("connection", (socket: WebSocket) => {
    const connection: Connection = { socket, deviceId: null, role: null };
    connections.add(connection);

    socket.on("message", (raw) => {
      let parsed: ClientMessage;
      try {
        parsed = clientMessageSchema.parse(JSON.parse(String(raw)));
      } catch {
        send(socket, { type: "error", message: "Unreadable message." });
        return;
      }

      // Everything except the handshake requires an authenticated device.
      if (parsed.type !== "hello" && connection.deviceId == null) {
        send(socket, { type: "error", message: "Send hello first." });
        return;
      }

      switch (parsed.type) {
        case "hello": {
          const result = store.join(parsed.token, parsed.deviceName ?? "");
          if ("error" in result) {
            send(socket, { type: "error", message: result.error });
            socket.close();
            return;
          }
          connection.deviceId = result.deviceId;
          connection.role = result.role;
          if (result.role === "host") store.setHostOnline(true);
          // Operational logging: the host runs this in a terminal during a
          // service and needs to see devices arriving and leaving.
          console.log(`[session] joined  ${result.role.padEnd(6)} ${parsed.deviceName ?? result.deviceId}`);
          send(socket, {
            type: "welcome",
            role: result.role,
            deviceId: result.deviceId,
            deviceToken: result.token,
            snapshot: store.getSnapshot(),
            protocol: PROTOCOL_VERSION,
          });
          broadcastDevices();
          if (result.role === "host") broadcastSnapshot();
          return;
        }

        case "command": {
          const outcome = store.evaluateCommand(
            connection.deviceId as string,
            parsed.messageId,
            parsed.expectedRevision,
            parsed.command,
          );

          if (outcome.status === "duplicate") {
            // Replaying a command must not run it twice.
            send(socket, { type: "ack", messageId: parsed.messageId, applied: true, revision: outcome.revision });
            return;
          }
          if (outcome.status === "stale") {
            send(socket, {
              type: "ack",
              messageId: parsed.messageId,
              applied: false,
              revision: outcome.revision,
              reason: "Your view was out of date. Try again.",
            });
            send(socket, { type: "snapshot", snapshot: store.getSnapshot() });
            return;
          }
          if (outcome.status === "denied") {
            send(socket, {
              type: "ack",
              messageId: parsed.messageId,
              applied: false,
              revision: store.revision,
              reason: outcome.reason,
            });
            return;
          }

          const host = hostConnection();
          if (!host) {
            send(socket, {
              type: "ack",
              messageId: parsed.messageId,
              applied: false,
              revision: store.revision,
              reason: "The host is offline. Command not applied.",
            });
            return;
          }

          const timer = setTimeout(() => {
            resolvePending(parsed.messageId, false, "Command not applied — the host did not respond.");
          }, HOST_ACK_TIMEOUT_MS);
          pending.set(parsed.messageId, {
            messageId: parsed.messageId,
            fromDeviceId: connection.deviceId as string,
            timer,
          });
          send(host.socket, {
            type: "run-command",
            messageId: parsed.messageId,
            command: parsed.command,
            fromDeviceId: connection.deviceId as string,
          });
          return;
        }

        case "host-command": {
          const permission = canRunHostCommand(connection.role as SessionRole);
          if (!permission.allowed) {
            send(socket, { type: "error", message: permission.reason ?? "Not allowed." });
            return;
          }
          const command = parsed.command;
          if (command.type === "set-remote-lock") {
            store.setRemoteControlLocked(command.locked);
            broadcastSnapshot();
          } else if (command.type === "lock-new-joins") {
            store.setJoinsLocked(command.locked);
          } else if (command.type === "revoke-device") {
            const target = [...connections].find((entry) => entry.deviceId === command.deviceId);
            store.removeDevice(command.deviceId);
            if (target) {
              send(target.socket, { type: "error", message: "This device was removed from the session." });
              target.socket.close();
            }
          } else {
            const result = store.setLeaderApproval(command.deviceId, command.approved);
            if (result.ok) {
              for (const entry of connections) {
                if (entry.deviceId === command.deviceId) {
                  entry.role = command.approved ? "leader" : "viewer";
                  send(entry.socket, {
                    type: "role-changed",
                    role: entry.role,
                    reason: command.approved ? "The host granted leader access." : "Leader access was removed.",
                  });
                }
                if (result.demoted && entry.deviceId === result.demoted) {
                  entry.role = "viewer";
                  send(entry.socket, {
                    type: "role-changed",
                    role: "viewer",
                    reason: "Leader access moved to another device.",
                  });
                }
              }
            }
          }
          send(socket, { type: "ack", messageId: parsed.messageId, applied: true, revision: store.revision });
          broadcastDevices();
          return;
        }

        case "host-state": {
          if (connection.role !== "host") {
            send(socket, { type: "error", message: "Only the host reports engine state." });
            return;
          }
          store.applyHostState(parsed.patch);
          broadcastSnapshot();
          return;
        }

        case "host-ack": {
          if (connection.role !== "host") return;
          resolvePending(parsed.messageId, parsed.applied, parsed.reason);
          broadcastSnapshot();
          return;
        }

        case "resync": {
          store.touch(connection.deviceId as string);
          send(socket, { type: "snapshot", snapshot: store.getSnapshot() });
          return;
        }

        case "ping": {
          store.touch(connection.deviceId as string);
          return;
        }
      }
    });

    socket.on("close", () => {
      if (connection.role) console.log(`[session] left    ${connection.role.padEnd(6)} ${connection.deviceId}`);
      connections.delete(connection);
      if (connection.role === "host") {
        // Host audio keeps running locally; only the session view changes.
        store.setHostOnline(false);
        broadcastSnapshot();
      }
      broadcastDevices();
    });

    socket.on("error", () => socket.close());
  });

  const heartbeat = setInterval(() => {
    broadcast({
      type: "heartbeat",
      serverTime: Date.now(),
      revision: store.revision,
      hostOnline: store.getSnapshot().hostOnline,
    });
  }, HEARTBEAT_INTERVAL_MS);

  const handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  };

  httpServer.on("close", () => clearInterval(heartbeat));

  return {
    store,
    handleUpgrade,
    broadcastSnapshot,
    close() {
      clearInterval(heartbeat);
      for (const entry of pending.values()) clearTimeout(entry.timer);
      pending.clear();
      wss.close();
    },
  };
}
