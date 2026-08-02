"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SessionConnection } from "@/lib/session/client";
import {
  type ConnectedDevice,
  type HostCommand,
  type LeaderCommand,
  type LiveSessionSnapshot,
  STALE_AFTER_MS,
  type SessionRole,
} from "@/lib/session/protocol";

export type SessionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "rejected";

/**
 * React view of the live session. The socket and its reconnection logic live in
 * SessionConnection; this hook only mirrors what arrives into state.
 *
 * Commands issued while disconnected are dropped on purpose (spec 18.9): a
 * queued key change that fires minutes later is worse than one that never ran.
 */
export function useSession() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [role, setRole] = useState<SessionRole | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSessionSnapshot | null>(null);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [lastAck, setLastAck] = useState<{ messageId: string; applied: boolean; reason?: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [age, setAge] = useState(0);

  const runCommandRef = useRef<((messageId: string, command: LeaderCommand) => void) | null>(null);
  const [inboundCommand, setInboundCommand] = useState<{ messageId: string; command: LeaderCommand } | null>(null);

  const [connection] = useState(() => {
    // The closure needs the instance itself so a rejected token can stop the
    // reconnect loop from inside the message handler.
    const created: SessionConnection = new SessionConnection({
      onStatus: (next) => {
        setStatus((current) => {
          if (current === "rejected") return current;
          return next === "closed" ? "idle" : next;
        });
      },
      onMessage: (parsed) => {
          switch (parsed.type) {
            case "welcome":
              setRole(parsed.role);
              setDeviceId(parsed.deviceId);
              setDeviceToken(parsed.deviceToken);
              setSnapshot(parsed.snapshot);
              setStatus("connected");
              setUpdatedAt(Date.now());
              setMessage(null);
              break;
            case "snapshot":
              setSnapshot(parsed.snapshot);
              setUpdatedAt(Date.now());
              break;
            case "devices":
              setDevices(parsed.devices);
              break;
            case "ack":
              setLastAck({ messageId: parsed.messageId, applied: parsed.applied, reason: parsed.reason });
              if (!parsed.applied && parsed.reason) setMessage(parsed.reason);
              break;
            case "run-command":
              // Handed to an effect below so the handler runs outside render.
              setInboundCommand({ messageId: parsed.messageId, command: parsed.command });
              break;
            case "role-changed":
              setRole(parsed.role);
              setMessage(parsed.reason);
              break;
            case "heartbeat":
              setUpdatedAt(Date.now());
              break;
            case "error":
              setMessage(parsed.message);
              // A rejected token must not turn into an endless reconnect loop.
              if (/no longer valid|removed|locked/.test(parsed.message)) {
                created.giveUp();
                setStatus("rejected");
              }
              break;
          }
      },
    });
    return created;
  });

  useEffect(() => {
    if (!inboundCommand) return;
    runCommandRef.current?.(inboundCommand.messageId, inboundCommand.command);
  }, [inboundCommand]);

  // The socket needs the newest revision to stamp outgoing commands with.
  useEffect(() => {
    if (snapshot) connection.setRevision(snapshot.revision);
  }, [connection, snapshot]);

  useEffect(() => {
    const timer = setInterval(() => setAge(Date.now() - updatedAt), 500);
    return () => clearInterval(timer);
  }, [updatedAt]);

  useEffect(() => () => connection.disconnect(), [connection]);

  const connect = useCallback((token: string, deviceName: string) => connection.connect(token, deviceName), [connection]);
  const disconnect = useCallback(() => connection.disconnect(), [connection]);

  const sendCommand = useCallback(
    (command: LeaderCommand): string | null => {
      const messageId = connection.sendCommand(command);
      if (!messageId) setMessage("Not connected. Command not applied.");
      return messageId;
    },
    [connection],
  );

  const sendHostCommand = useCallback((command: HostCommand) => connection.sendHostCommand(command), [connection]);
  const sendHostState = useCallback(
    (patch: Partial<LiveSessionSnapshot>) => connection.sendHostState(patch),
    [connection],
  );
  const acknowledge = useCallback(
    (messageId: string, applied: boolean, reason?: string) => connection.acknowledge(messageId, applied, reason),
    [connection],
  );
  const onRunCommand = useCallback((handler: ((messageId: string, command: LeaderCommand) => void) | null) => {
    runCommandRef.current = handler;
  }, []);

  return {
    status,
    role,
    deviceId,
    deviceToken,
    snapshot,
    devices,
    age,
    stale: status === "connected" ? age > STALE_AFTER_MS : status !== "idle",
    lastAck,
    message,
    connect,
    disconnect,
    sendCommand,
    sendHostCommand,
    sendHostState,
    acknowledge,
    onRunCommand,
  };
}

export type SessionClient = ReturnType<typeof useSession>;
