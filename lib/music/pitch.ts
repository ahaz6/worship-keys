/**
 * Pitch primitives.
 *
 * Everything musical in Worship Keys is normalised to a pitch class 0-11 with
 * C = 0. Spelling (Bb vs A#) is a presentation concern handled in notation.ts,
 * never something the detection or Nashville maths depends on.
 */

export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type Mode = "major" | "minor";

/** Modulo that returns a non-negative result for negative inputs. */
export function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export function toPitchClass(value: number): PitchClass {
  return mod(Math.round(value), 12) as PitchClass;
}

export const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** MIDI note 60 is middle C, and 60 % 12 === 0, so the mapping is direct. */
export function midiToPitchClass(midiNote: number): PitchClass {
  return toPitchClass(midiNote);
}

export function midiToOctave(midiNote: number): number {
  return Math.floor(midiNote / 12) - 1;
}

/** Interval from `from` up to `to`, always 0-11. */
export function intervalBetween(from: PitchClass, to: PitchClass): number {
  return mod(to - from, 12);
}

/** True for the seven white keys of C major — used for the keyboard strip. */
export function isAccidental(pitchClass: PitchClass): boolean {
  return [1, 3, 6, 8, 10].includes(pitchClass);
}
