/**
 * Voice command parsing (spec section 16).
 *
 * Recognition is only ever an *input* here. Nothing in this module touches
 * audio: it turns a transcript into an intent plus a confidence judgement, and
 * the caller decides whether that intent is allowed to act. Anything below the
 * confidence floor, or anything that needs the wake word and did not get it,
 * comes back as a suggestion the musician has to confirm.
 */

import { parseNoteName } from "@/lib/music/notation";
import type { Mode, PitchClass } from "@/lib/music/pitch";

export type VoiceCommand =
  | { type: "prepare"; tonic: PitchClass; mode: Mode }
  | { type: "switch-now" }
  | { type: "crescendo" }
  | { type: "cancel-transition" }
  | { type: "stop-pads" }
  | { type: "next-song" }
  | { type: "previous-song" };

export type ParsedCommand = {
  command: VoiceCommand;
  /** Short uppercase label for the command card, e.g. `PREPARE G MINOR`. */
  label: string;
  /** Confidence reported by the recogniser, carried through unchanged. */
  confidence: number;
  /** True when the phrase was preceded by the wake word. */
  wakeWord: boolean;
  /** False when the caller must ask for confirmation before acting. */
  actionable: boolean;
  /** Reason it is not actionable, for the transcript strip. */
  hold: string | null;
};

export const WAKE_WORD = "worship keys";

export type ParseOptions = {
  /** Minimum recogniser confidence before a command may act on its own. */
  minConfidence?: number;
  /** When true, only phrases carrying the wake word may act automatically. */
  requireWakeWord?: boolean;
};

const DEFAULT_MIN_CONFIDENCE = 0.6;

/** Spoken accidentals, so "b flat" and "f sharp" both resolve. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\bflat\b/g, "b")
    .replace(/\bsharp\b/g, "#")
    // Join the accidental onto the note letter only: "b flat" becomes "bb",
    // while the "e" ending "prepare" is left alone.
    .replace(/\b([a-g])\s+([b#])(?=\s|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

function parseKeyPhrase(phrase: string): { tonic: PitchClass; mode: Mode } | null {
  const match = /^([a-g][b#]?)(?:\s+(major|minor|minor key|major key|m))?$/.exec(phrase.trim());
  if (!match) return null;
  const tonic = parseNoteName(match[1] as string);
  if (tonic == null) return null;
  const modeWord = match[2] ?? "";
  const mode: Mode = modeWord.startsWith("minor") || modeWord === "m" ? "minor" : "major";
  return { tonic, mode };
}

function keyLabel(tonic: PitchClass, mode: Mode): string {
  const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  return `${names[tonic]}${mode === "minor" ? " MINOR" : ""}`;
}

/**
 * Parses one final transcript segment. Returns null when nothing in the phrase
 * looks like a command — ordinary talking must not trigger anything.
 */
export function parseVoiceCommand(transcript: string, confidence: number, options: ParseOptions = {}): ParsedCommand | null {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const requireWakeWord = options.requireWakeWord ?? false;

  let text = normalise(transcript);
  let wakeWord = false;
  if (text.startsWith(WAKE_WORD)) {
    wakeWord = true;
    text = text.slice(WAKE_WORD.length).trim();
  }

  const found = matchCommand(text);
  if (!found) return null;

  let hold: string | null = null;
  if (confidence < minConfidence) hold = "Not confident enough — confirm to run";
  else if (requireWakeWord && !wakeWord) hold = `Say "${WAKE_WORD}" first, or confirm to run`;

  return {
    command: found.command,
    label: found.label,
    confidence,
    wakeWord,
    actionable: hold == null,
    hold,
  };
}

function matchCommand(text: string): { command: VoiceCommand; label: string } | null {
  const prepare = /^(?:prepare|prep|get ready for|going to)\s+(.+)$/.exec(text);
  if (prepare) {
    const key = parseKeyPhrase(prepare[1] as string);
    if (key) return { command: { type: "prepare", ...key }, label: `PREPARE ${keyLabel(key.tonic, key.mode)}` };
    return null;
  }

  if (/^(?:switch now|key switch|switch key|change key now|switch)$/.test(text)) {
    return { command: { type: "switch-now" }, label: "SWITCH NOW" };
  }
  if (/^(?:crescendo|build|lift it)$/.test(text)) {
    return { command: { type: "crescendo" }, label: "CRESCENDO" };
  }
  if (/^(?:cancel transition|cancel preparation|cancel|never mind)$/.test(text)) {
    return { command: { type: "cancel-transition" }, label: "CANCEL TRANSITION" };
  }
  if (/^(?:stop pads|stop the pads|pads off|stop)$/.test(text)) {
    return { command: { type: "stop-pads" }, label: "STOP PADS" };
  }
  if (/^(?:next song|next)$/.test(text)) {
    return { command: { type: "next-song" }, label: "NEXT SONG" };
  }
  if (/^(?:previous song|previous|last song|go back)$/.test(text)) {
    return { command: { type: "previous-song" }, label: "PREVIOUS SONG" };
  }
  return null;
}

/**
 * Commands that may run the moment they are recognised. Everything else waits
 * for a visible confirmation, because a wrong key change mid-song is worse than
 * a command that needs one extra tap.
 */
export function isImmediateCommand(command: VoiceCommand): boolean {
  return command.type === "stop-pads" || command.type === "cancel-transition" || command.type === "prepare";
}
