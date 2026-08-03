/**
 * Local live session wire protocol (spec 18.5, 18.6).
 *
 * Only small state messages cross the network. Audio never does: the host
 * MacBook keeps making sound whether or not any iPad is reachable.
 *
 * Every mutating message carries a `messageId` for idempotency and an
 * `expectedRevision` so a command built against a stale view is rejected
 * instead of silently overwriting someone else's change.
 */

import { z } from "zod";
import { setlistSchema, songSchema } from "../storage/schema.ts";

export type SessionRole = "host" | "leader" | "viewer";

export const PROTOCOL_VERSION = 1;

/* ------------------------------------------------------------- snapshot -- */

export const transcriptSegmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  final: z.boolean(),
  /** Present when this line was recognised as a command. */
  command: z.string().optional(),
  at: z.number(),
});

export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

export const livePadSettingsSchema = z.object({
  mainVolume: z.number().min(0).max(100),
  shimmer: z.number().min(0).max(100),
  tone: z.number().min(0).max(100),
  brightness: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  motion: z.number().min(0).max(100),
  fadeInSeconds: z.number().min(0.5).max(20),
  fadeOutSeconds: z.number().min(0.5).max(20),
  crossfadeSeconds: z.number().min(1).max(12),
  crescendoSeconds: z.number().min(1).max(20),
});

export type LivePadSettings = z.infer<typeof livePadSettingsSchema>;

export const snapshotSchema = z.object({
  sessionId: z.string(),
  sessionName: z.string(),
  revision: z.number(),
  serverTime: z.number(),
  hostOnline: z.boolean(),
  remoteControlLocked: z.boolean(),
  joinsLocked: z.boolean(),
  activeSong: z
    .object({
      id: z.string(),
      title: z.string(),
      artist: z.string().optional(),
      position: z.number(),
      total: z.number(),
    })
    .nullable(),
  setlist: setlistSchema.optional(),
  concertKey: z.string(),
  mode: z.enum(["major", "minor"]),
  timeSignature: z.string(),
  bpm: z.number().optional(),
  detectedChord: z.string().optional(),
  nashville: z.string().optional(),
  chordConfidence: z.number().optional(),
  midiPressed: z.array(z.number().int().min(0).max(127)),
  midiSustained: z.array(z.number().int().min(0).max(127)),
  midiDeviceName: z.string().optional(),
  preparedKey: z.string().optional(),
  transitionState: z.enum(["idle", "armed", "crescendo", "transitioning"]),
  padState: z.enum(["stopped", "fading-in", "playing", "fading-out"]),
  /** Lightweight host telemetry used to mirror live audio automation remotely. */
  padProgress: z.number().min(0).max(1),
  crossfading: z.boolean(),
  crescendoActive: z.boolean(),
  padSettings: livePadSettingsSchema,
  muted: z.boolean(),
  transcript: z.array(transcriptSegmentSchema),
});

export type LiveSessionSnapshot = z.infer<typeof snapshotSchema>;

export function createEmptySnapshot(sessionId: string, sessionName: string): LiveSessionSnapshot {
  return {
    sessionId,
    sessionName,
    revision: 0,
    serverTime: Date.now(),
    hostOnline: false,
    remoteControlLocked: false,
    joinsLocked: false,
    activeSong: null,
    concertKey: "C Major",
    mode: "major",
    timeSignature: "4/4",
    midiPressed: [],
    midiSustained: [],
    transitionState: "idle",
    padState: "stopped",
    padProgress: 0,
    crossfading: false,
    crescendoActive: false,
    padSettings: {
      mainVolume: 62,
      shimmer: 100,
      tone: 100,
      brightness: 0,
      width: 0,
      motion: 18,
      fadeInSeconds: 4,
      fadeOutSeconds: 4,
      crossfadeSeconds: 4,
      crescendoSeconds: 6,
    },
    muted: false,
    transcript: [],
  };
}

/* -------------------------------------------------------------- commands -- */

/** Everything a confirmed leader is allowed to ask the host to do. */
export const leaderCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("select-song"), songId: z.string() }),
  z.object({ type: z.literal("next-song") }),
  z.object({ type: z.literal("previous-song") }),
  z.object({ type: z.literal("set-bpm"), bpm: z.number().int().min(40).max(180) }),
  z.object({ type: z.literal("add-song"), song: songSchema }),
  z.object({ type: z.literal("update-song"), song: songSchema }),
  z.object({ type: z.literal("remove-song"), songId: z.string().min(1) }),
  z.object({ type: z.literal("duplicate-song"), songId: z.string().min(1) }),
  z.object({ type: z.literal("rename-setlist"), name: z.string().min(1).max(120) }),
  z.object({ type: z.literal("replace-setlist"), setlist: setlistSchema }),
  z.object({ type: z.literal("set-key"), tonic: z.number().int().min(0).max(11), mode: z.enum(["major", "minor"]) }),
  z.object({ type: z.literal("prepare"), tonic: z.number().int().min(0).max(11), mode: z.enum(["major", "minor"]) }),
  z.object({ type: z.literal("cancel-preparation") }),
  z.object({ type: z.literal("switch-now") }),
  z.object({ type: z.literal("crescendo") }),
  z.object({ type: z.literal("fade-in") }),
  z.object({ type: z.literal("fade-out") }),
  z.object({ type: z.literal("stop-pads") }),
  z.object({ type: z.literal("set-pad-settings"), patch: livePadSettingsSchema.partial() }),
  z.object({ type: z.literal("set-muted"), muted: z.boolean() }),
]);

export type LeaderCommand = z.infer<typeof leaderCommandSchema>;

/** Host-only actions. Never accepted from a leader or viewer connection. */
export const hostCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set-remote-lock"), locked: z.boolean() }),
  z.object({ type: z.literal("revoke-device"), deviceId: z.string() }),
  z.object({ type: z.literal("set-leader"), deviceId: z.string(), approved: z.boolean() }),
  z.object({ type: z.literal("lock-new-joins"), locked: z.boolean() }),
]);

export type HostCommand = z.infer<typeof hostCommandSchema>;

/* --------------------------------------------------------- client → server */

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), token: z.string().min(8), deviceName: z.string().max(60).optional() }),
  z.object({
    type: z.literal("command"),
    messageId: z.string().min(4),
    expectedRevision: z.number().int().nonnegative(),
    command: leaderCommandSchema,
  }),
  z.object({ type: z.literal("host-command"), messageId: z.string().min(4), command: hostCommandSchema }),
  /** The host reporting the real audio/MIDI state it is producing. */
  z.object({ type: z.literal("host-state"), patch: snapshotSchema.partial() }),
  /** The host confirming (or refusing) a leader command it was asked to run. */
  z.object({ type: z.literal("host-ack"), messageId: z.string(), applied: z.boolean(), reason: z.string().optional() }),
  z.object({ type: z.literal("resync") }),
  z.object({ type: z.literal("ping") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

/* --------------------------------------------------------- server → client */

export type ConnectedDevice = {
  deviceId: string;
  role: SessionRole;
  name: string;
  lastSeen: number;
  leaderRequested: boolean;
};

export type ServerMessage =
  | {
      type: "welcome";
      role: SessionRole;
      deviceId: string;
      /** Per-device token; the client stores it so a reload keeps its role. */
      deviceToken: string;
      snapshot: LiveSessionSnapshot;
      protocol: number;
    }
  | { type: "snapshot"; snapshot: LiveSessionSnapshot }
  | { type: "ack"; messageId: string; applied: boolean; revision: number; reason?: string }
  | { type: "devices"; devices: ConnectedDevice[] }
  /** Forwarded to the host only, so it can perform the actual audio action. */
  | { type: "run-command"; messageId: string; command: LeaderCommand; fromDeviceId: string }
  | { type: "role-changed"; role: SessionRole; reason: string }
  | { type: "heartbeat"; serverTime: number; revision: number; hostOnline: boolean }
  | { type: "error"; message: string };

/** How long a forwarded command may wait for the host before it is refused. */
export const HOST_ACK_TIMEOUT_MS = 8000;
export const HEARTBEAT_INTERVAL_MS = 3000;
/** Viewers mark their data stale after this long without an update. */
export const STALE_AFTER_MS = 6000;
/** Only the last few transcript lines travel over the wire. */
export const TRANSCRIPT_WINDOW = 6;
