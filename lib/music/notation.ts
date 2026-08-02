/**
 * Enharmonic spelling.
 *
 * One central place decides whether pitch class 10 reads as "Bb" or "A#".
 * Spec section 7: flat-leaning keys prefer Bb/Eb/Ab/Db/Gb, sharp-leaning keys
 * may use F#/C#, and the user can force either or leave it on Auto.
 */

import { type PitchClass, type Mode, mod } from "./pitch";

export type NotationPreference = "auto" | "flats" | "sharps";

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

/**
 * Keys whose signatures are written with sharps, as concert major tonics:
 * G, D, A, E, B major, plus the relative minors E, B, F#, C#, G#, D#.
 *
 * Pitch class 6 is deliberately absent from the major list. Gb and F# major are
 * equally valid spellings, and spec section 7 names Gb among the flat-leaning
 * keys to prefer. F# minor stays sharp — it is the relative minor of A major.
 */
const SHARP_MAJOR_TONICS: readonly PitchClass[] = [7, 2, 9, 4, 11];
const SHARP_MINOR_TONICS: readonly PitchClass[] = [4, 11, 6, 1, 8, 3];

/** Does this concert key traditionally spell its accidentals as sharps? */
export function keyPrefersSharps(tonic: PitchClass, mode: Mode): boolean {
  const table = mode === "major" ? SHARP_MAJOR_TONICS : SHARP_MINOR_TONICS;
  return table.includes(tonic);
}

export type SpellingContext = {
  preference: NotationPreference;
  keyTonic?: PitchClass;
  keyMode?: Mode;
};

function prefersSharpSpelling(context: SpellingContext): boolean {
  if (context.preference === "sharps") return true;
  if (context.preference === "flats") return false;
  if (context.keyTonic === undefined || context.keyMode === undefined) return false;
  return keyPrefersSharps(context.keyTonic, context.keyMode);
}

/** Note name for a pitch class, e.g. `Bb` or `A#`. */
export function spellPitchClass(pitchClass: PitchClass, context: SpellingContext): string {
  const names = prefersSharpSpelling(context) ? SHARP_NAMES : FLAT_NAMES;
  return names[pitchClass] as string;
}

/** Both readings of an ambiguous pitch class, for key pads: `Db/C#`. */
export function spellPitchClassBoth(pitchClass: PitchClass): string {
  const sharp = SHARP_NAMES[pitchClass] as string;
  const flat = FLAT_NAMES[pitchClass] as string;
  return sharp === flat ? sharp : `${flat}/${sharp}`;
}

/** Human-readable concert key, e.g. `G Major` or `Eb Minor`. */
export function spellKey(tonic: PitchClass, mode: Mode, preference: NotationPreference = "auto"): string {
  const name = spellPitchClass(tonic, { preference, keyTonic: tonic, keyMode: mode });
  return `${name} ${mode === "major" ? "Major" : "Minor"}`;
}

/** Short concert key label for dense UI, e.g. `G` / `Ebm`. */
export function spellKeyShort(tonic: PitchClass, mode: Mode, preference: NotationPreference = "auto"): string {
  const name = spellPitchClass(tonic, { preference, keyTonic: tonic, keyMode: mode });
  return mode === "major" ? name : `${name}m`;
}

/** Parses `G`, `Bb`, `F#`, `Ab` etc. into a pitch class. Case-insensitive. */
export function parseNoteName(input: string): PitchClass | null {
  const cleaned = input.trim().replace(/♭/g, "b").replace(/♯/g, "#");
  const match = /^([a-gA-G])([b#]?)$/.exec(cleaned);
  if (!match) return null;
  const letter = (match[1] as string).toUpperCase();
  const accidental = match[2] as string;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const semitone = base[letter];
  if (semitone === undefined) return null;
  const offset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return mod(semitone + offset, 12) as PitchClass;
}
