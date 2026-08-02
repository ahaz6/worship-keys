/**
 * Chord vocabulary for the MVP detector (spec section 10.1).
 *
 * `intervals` are semitones above the root. `essential` marks the degrees whose
 * absence should disqualify a candidate outright — for a minor 7th the third
 * and seventh carry the identity, the fifth does not.
 */

export type ChordQuality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "sus2"
  | "sus4"
  | "7"
  | "maj7"
  | "min7"
  | "add9"
  | "madd9"
  | "6"
  | "m6"
  | "5";

export type ChordTemplate = {
  quality: ChordQuality;
  /** Suffix appended to the root name, e.g. `Gsus4`. */
  suffix: string;
  /** Suffix appended to a Nashville degree, e.g. `4sus4`. */
  nashvilleSuffix: string;
  intervals: readonly number[];
  essential: readonly number[];
  /** Baseline plausibility. Power chords are real but weak evidence. */
  weight: number;
  /** Third of the chord as a semitone offset, if the quality defines one. */
  third: 3 | 4 | null;
};

export const CHORD_TEMPLATES: readonly ChordTemplate[] = [
  { quality: "maj", suffix: "", nashvilleSuffix: "", intervals: [0, 4, 7], essential: [0, 4], weight: 1.0, third: 4 },
  { quality: "min", suffix: "m", nashvilleSuffix: "m", intervals: [0, 3, 7], essential: [0, 3], weight: 1.0, third: 3 },
  { quality: "dim", suffix: "°", nashvilleSuffix: "°", intervals: [0, 3, 6], essential: [0, 3, 6], weight: 0.94, third: 3 },
  { quality: "aug", suffix: "+", nashvilleSuffix: "+", intervals: [0, 4, 8], essential: [0, 4, 8], weight: 0.9, third: 4 },
  { quality: "sus2", suffix: "sus2", nashvilleSuffix: "sus2", intervals: [0, 2, 7], essential: [0, 2, 7], weight: 0.9, third: null },
  { quality: "sus4", suffix: "sus4", nashvilleSuffix: "sus4", intervals: [0, 5, 7], essential: [0, 5, 7], weight: 0.9, third: null },
  { quality: "7", suffix: "7", nashvilleSuffix: "7", intervals: [0, 4, 7, 10], essential: [0, 4, 10], weight: 1.02, third: 4 },
  { quality: "maj7", suffix: "maj7", nashvilleSuffix: "maj7", intervals: [0, 4, 7, 11], essential: [0, 4, 11], weight: 1.02, third: 4 },
  { quality: "min7", suffix: "m7", nashvilleSuffix: "m7", intervals: [0, 3, 7, 10], essential: [0, 3, 10], weight: 1.02, third: 3 },
  { quality: "add9", suffix: "add9", nashvilleSuffix: "add9", intervals: [0, 2, 4, 7], essential: [0, 2, 4], weight: 1.0, third: 4 },
  { quality: "madd9", suffix: "m(add9)", nashvilleSuffix: "m(add9)", intervals: [0, 2, 3, 7], essential: [0, 2, 3], weight: 0.98, third: 3 },
  { quality: "6", suffix: "6", nashvilleSuffix: "6", intervals: [0, 4, 7, 9], essential: [0, 4, 9], weight: 0.96, third: 4 },
  { quality: "m6", suffix: "m6", nashvilleSuffix: "m6", intervals: [0, 3, 7, 9], essential: [0, 3, 9], weight: 0.94, third: 3 },
  { quality: "5", suffix: "5", nashvilleSuffix: "5", intervals: [0, 7], essential: [0, 7], weight: 0.66, third: null },
];

/** Is the template's third minor? Drives the `m` in Nashville output. */
export function isMinorQuality(quality: ChordQuality): boolean {
  const template = CHORD_TEMPLATES.find((entry) => entry.quality === quality);
  return template?.third === 3;
}
