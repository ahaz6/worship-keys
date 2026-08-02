/**
 * Nashville Number System (spec section 12).
 *
 * Degree names are always measured against the *parallel major* scale of the
 * concert key, which is why a minor-key ♭3 is written "♭3" rather than "3".
 * That single rule covers both the major and the minor tables in the spec, so
 * only the expected chord quality differs between modes.
 *
 * The quality shown always comes from the chord that was actually played. A D
 * major in the key of C reads "2", never "2m".
 */

import type { ChordCandidate } from "./chord-detector";
import { CHORD_TEMPLATES, type ChordQuality } from "./chord-templates";
import type { NotationPreference } from "./notation";
import { type Mode, type PitchClass, mod, toPitchClass } from "./pitch";

export type NashvilleNumber = {
  /** Degree with any accidental, e.g. `1`, `♭3`, `♯4`. */
  degree: string;
  /** Quality/extension suffix, e.g. `m`, `7`, `sus4`. Rendered smaller. */
  suffix: string;
  /** Degree of the bass note when the chord is inverted, else null. */
  bassDegree: string | null;
  /** Flat single-line rendering, e.g. `5/7`, `2m7`. */
  text: string;
};

/** Semitones above the tonic → degree name against the parallel major scale. */
function degreeName(semitones: number, preference: NotationPreference): string {
  switch (mod(semitones, 12)) {
    case 0:
      return "1";
    case 1:
      return "♭2";
    case 2:
      return "2";
    case 3:
      return "♭3";
    case 4:
      return "3";
    case 5:
      return "4";
    case 6:
      // Both spellings are in use; the preference decides which one is shown.
      return preference === "flats" ? "♭5" : "♯4";
    case 7:
      return "5";
    case 8:
      return "♭6";
    case 9:
      return "6";
    case 10:
      return "♭7";
    default:
      return "7";
  }
}

/** The diatonic quality a listener expects at this degree (spec tables 12.1). */
export function expectedQuality(semitones: number, mode: Mode): ChordQuality | null {
  const step = mod(semitones, 12);
  if (mode === "major") {
    const table: Record<number, ChordQuality> = { 0: "maj", 2: "min", 4: "min", 5: "maj", 7: "maj", 9: "min", 11: "dim" };
    return table[step] ?? null;
  }
  const table: Record<number, ChordQuality> = { 0: "min", 2: "dim", 3: "maj", 5: "min", 7: "min", 8: "maj", 10: "maj" };
  return table[step] ?? null;
}

function suffixFor(quality: ChordQuality): string {
  return CHORD_TEMPLATES.find((template) => template.quality === quality)?.nashvilleSuffix ?? "";
}

export type NashvilleOptions = {
  preference?: NotationPreference;
  /** Live mode drops extensions and keeps only the degree and minor marker. */
  simplified?: boolean;
};

/** Nashville number for an explicit chord root and quality. */
export function toNashville(
  root: PitchClass,
  quality: ChordQuality,
  keyTonic: PitchClass,
  options: NashvilleOptions = {},
  bass: PitchClass | null = null,
): NashvilleNumber {
  const preference = options.preference ?? "auto";
  const degree = degreeName(root - keyTonic, preference);
  const fullSuffix = suffixFor(quality);
  // Simplified mode keeps the minor marker only — "2m" instead of "2m7".
  const suffix = options.simplified ? (fullSuffix.startsWith("m") ? "m" : fullSuffix === "°" ? "°" : "") : fullSuffix;
  const bassDegree = bass != null && bass !== root ? degreeName(bass - keyTonic, preference) : null;
  const text = `${degree}${suffix}${bassDegree ? `/${bassDegree}` : ""}`;
  return { degree, suffix, bassDegree, text };
}

/** Convenience wrapper for a detector result. */
export function nashvilleForCandidate(
  candidate: ChordCandidate,
  keyTonic: PitchClass,
  options: NashvilleOptions = {},
): NashvilleNumber {
  return toNashville(candidate.root, candidate.quality, keyTonic, options, candidate.bass);
}

/**
 * Stage display number for the lowest sounding note. Accidentals and chord
 * quality are intentionally removed, leaving one calm scale number from 1–7.
 * The full chord remains available separately through chord detection.
 */
export function simpleBassNumberForCandidate(candidate: ChordCandidate, keyTonic: PitchClass): string {
  const bass = candidate.bass ?? candidate.root;
  return degreeName(bass - keyTonic, "auto").replace(/[♭♯]/g, "");
}

/**
 * Stage-display number taken straight from the physical bass register.
 *
 * This intentionally does not depend on chord detection: a low sustained root
 * remains the displayed foundation while the right hand adds melody notes or
 * wider voicings above it. Octave doubles naturally collapse to one pitch
 * class, so C1, C2 and C5 all produce the same Nashville number.
 */
export function simpleBassNumberForMidiNote(bassMidiNote: number, keyTonic: PitchClass): string {
  return degreeName(toPitchClass(bassMidiNote) - keyTonic, "auto").replace(/[♭♯]/g, "");
}
