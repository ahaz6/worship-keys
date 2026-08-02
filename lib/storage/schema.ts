/**
 * Persisted data shapes and their migrations (spec 14, 22).
 *
 * Everything read back from IndexedDB goes through Zod. A setlist written by an
 * older version must either migrate cleanly or be reported — it must never
 * crash the app minutes before a service.
 */

import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1;

const pitchClassSchema = z.number().int().min(0).max(11);

export const timeSignatureSchema = z.object({
  numerator: z.number().int().min(1).max(32),
  denominator: z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16)]),
});

export const songSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  artist: z.string().max(120).optional(),
  concertKey: pitchClassSchema,
  mode: z.enum(["major", "minor"]),
  timeSignature: timeSignatureSchema,
  bpm: z.number().int().min(20).max(300).optional(),
  padPresetId: z.string().min(1),
  mainVolume: z.number().min(0).max(100).optional(),
  shimmerLevel: z.number().min(0).max(100).optional(),
  padMotion: z.number().min(0).max(100).optional(),
  tone: z.number().min(0).max(100).optional(),
  brightness: z.number().min(0).max(100).optional(),
  stereoWidth: z.number().min(0).max(100).optional(),
  crossfadeSeconds: z.number().min(1).max(12).optional(),
  fadeInSeconds: z.number().min(0.5).max(20).optional(),
  fadeOutSeconds: z.number().min(0.5).max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const setlistSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  date: z.string().optional(),
  songs: z.array(songSchema),
  activeSongId: z.string().optional(),
});

export const preferencesSchema = z.object({
  notation: z.enum(["auto", "flats", "sharps"]).default("auto"),
  allowAnyTargetKeyChord: z.boolean().default(false),
  voiceLanguage: z.string().default("en-US"),
  requireWakeWord: z.boolean().default(true),
  /** Input transpose remembered per MIDI device id. */
  inputTransposeByDevice: z.record(z.string(), z.number().int().min(-12).max(12)).default({}),
  liveMode: z.boolean().default(false),
});

export const persistedStateSchema = z.object({
  schemaVersion: z.number().int().min(1),
  setlist: setlistSchema,
  preferences: preferencesSchema,
});

export type TimeSignature = z.infer<typeof timeSignatureSchema>;
export type Song = z.infer<typeof songSchema>;
export type Setlist = z.infer<typeof setlistSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type PersistedState = z.infer<typeof persistedStateSchema>;

export type MigrationResult =
  | { ok: true; state: PersistedState; migratedFrom: number | null }
  | { ok: false; message: string };

/**
 * Brings stored data up to the current schema version.
 *
 * Version 1 is the first shipped shape, so there is nothing to convert yet.
 * The branch exists so a later version has an obvious place to live and so an
 * unknown *newer* version is refused rather than silently misread.
 */
export function migratePersistedState(raw: unknown): MigrationResult {
  if (raw == null || typeof raw !== "object") return { ok: false, message: "Saved setlist could not be read." };

  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== "number") return { ok: false, message: "Saved setlist has no version and was ignored." };

  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      message: "This setlist was saved by a newer version of Worship Keys. Update the app to open it.",
    };
  }

  const parsed = persistedStateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Saved setlist did not match the expected format and was not loaded." };
  }

  return { ok: true, state: parsed.data, migratedFrom: version === CURRENT_SCHEMA_VERSION ? null : version };
}

/** Formats a time signature for display. */
export function formatTimeSignature(signature: TimeSignature): string {
  return `${signature.numerator}/${signature.denominator}`;
}

/**
 * Beat and bar durations (spec 15). Denominator matters: 4/8 is not 4/4 with a
 * different label, and any future click must use exactly this maths.
 */
export function beatDurationSeconds(bpm: number, signature: TimeSignature): number {
  return (60 / bpm) * (4 / signature.denominator);
}

export function barDurationSeconds(bpm: number, signature: TimeSignature): number {
  return beatDurationSeconds(bpm, signature) * signature.numerator;
}

export const SUPPORTED_TIME_SIGNATURES: readonly TimeSignature[] = [
  { numerator: 4, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 6, denominator: 8 },
  { numerator: 4, denominator: 8 },
  { numerator: 4, denominator: 16 },
];
