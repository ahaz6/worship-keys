"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SessionConnection } from "@/lib/session/client";
import { CloudSessionConnection, type CloudBootstrap } from "@/lib/session/cloud-session";
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
  const rejectedRef = useRef(false);
  const activeTransportRef = useRef<"socket" | "cloud">("socket");

  const runCommandRef = useRef<((messageId: string, command: LeaderCommand) => void) | null>(null);
  // These refs are only read later by transport callbacks, never by the state
  // initializer while React is rendering it.
  // eslint-disable-next-line react-hooks/refs
  const [transports] = useState(() => {
    const holder: { socket?: SessionConnection; cloud?: CloudSessionConnection } = {};
    const events = {
      onStatus: (next: "connecting" | "connected" | "reconnecting" | "closed") => {
        // giveUp() closes a revoked connection intentionally. Do not let that
        // final close event erase the rejected state before the join screen can
        // clear its persisted device identity.
        if (next === "closed" && rejectedRef.current) return;
        setStatus(next === "closed" ? "idle" : next);
      },
      onMessage: (parsed: import("@/lib/session/protocol").ServerMessage) => {
          switch (parsed.type) {
            case "welcome":
              rejectedRef.current = false;
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
              // Do not funnel rapid slider messages through React state: two
              // frames arriving before a render would otherwise collapse into
              // one and the host would miss part of the live gesture.
              runCommandRef.current?.(parsed.messageId, parsed.command);
              break;
            case "role-changed":
              setRole(parsed.role);
              // Successful promotion is reflected by the LEADER · LIVE chip;
              // it does not need the old full-width notification banner.
              setMessage(parsed.role === "leader" ? null : parsed.reason);
              break;
            case "heartbeat":
              setUpdatedAt(Date.now());
              break;
            case "error":
              setMessage(parsed.message);
              // A rejected token must not turn into an endless reconnect loop.
              if (/no longer valid|removed|locked/.test(parsed.message)) {
                rejectedRef.current = true;
                if (activeTransportRef.current === "cloud") holder.cloud?.giveUp();
                else holder.socket?.giveUp();
                setStatus("rejected");
              }
              break;
          }
      },
    };
    const socket = new SessionConnection(events);
    const cloud = new CloudSessionConnection(events);
    holder.socket = socket;
    holder.cloud = cloud;
    return { socket, cloud };
  });

  // The socket needs the newest revision to stamp outgoing commands with.
  useEffect(() => {
    if (!snapshot) return;
    transports.socket.setRevision(snapshot.revision);
    transports.cloud.setRevision(snapshot.revision);
  }, [snapshot, transports]);

  useEffect(() => {
    const timer = setInterval(() => setAge(Date.now() - updatedAt), 500);
    return () => clearInterval(timer);
  }, [updatedAt]);

  useEffect(() => () => {
    transports.socket.disconnect();
    transports.cloud.disconnect();
  }, [transports]);

  const connect = useCallback(
    (token: string, deviceName: string, websocketUrl?: string) => {
      rejectedRef.current = false;
      activeTransportRef.current = "socket";
      transports.cloud.disconnect();
      transports.socket.connect(token, deviceName, websocketUrl);
    },
    [transports],
  );
  const connectCloud = useCallback((token: string, deviceName: string, storedDeviceToken?: string | null) => {
    rejectedRef.current = false;
    activeTransportRef.current = "cloud";
    transports.socket.disconnect();
    transports.cloud.connect(token, deviceName, storedDeviceToken);
  }, [transports]);
  const startCloudHost = useCallback((bootstrap: CloudBootstrap, sessionName?: string) => {
    rejectedRef.current = false;
    activeTransportRef.current = "cloud";
    transports.socket.disconnect();
    transports.cloud.startHost(bootstrap, sessionName);
  }, [transports]);
  const disconnect = useCallback(() => {
    transports.socket.disconnect();
    transports.cloud.disconnect();
  }, [transports]);

  const activeTransport = useCallback(
    () => activeTransportRef.current === "cloud" ? transports.cloud : transports.socket,
    [transports],
  );

  const sendCommand = useCallback(
    (command: LeaderCommand): string | null => {
      const messageId = activeTransport().sendCommand(command);
      if (!messageId) setMessage("Not connected. Command not applied.");
      return messageId;
    },
    [activeTransport],
  );

  const sendHostCommand = useCallback((command: HostCommand) => activeTransport().sendHostCommand(command), [activeTransport]);
  const sendHostState = useCallback(
    (patch: Partial<LiveSessionSnapshot>) => activeTransport().sendHostState(patch),
    [activeTransport],
  );
  const acknowledge = useCallback(
    (messageId: string, applied: boolean, reason?: string) => activeTransport().acknowledge(messageId, applied, reason),
    [activeTransport],
  );
  const requestLeader = useCallback((pin: string) => transports.cloud.requestLeader(pin), [transports]);
  const rotateCloudPin = useCallback(() => transports.cloud.rotatePin(), [transports]);
  const onRunCommand = useCallback((handler: ((messageId: string, command: LeaderCommand) => void) | null) => {
    runCommandRef.current = handler;
  }, []);
  const dismissMessage = useCallback(() => setMessage(null), []);

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
    connectCloud,
    startCloudHost,
    disconnect,
    sendCommand,
    sendHostCommand,
    sendHostState,
    acknowledge,
    requestLeader,
    rotateCloudPin,
    onRunCommand,
    dismissMessage,
  };
}

export type SessionClient = ReturnType<typeof useSession>;
