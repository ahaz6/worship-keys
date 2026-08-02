/**
 * Transposition (spec section 11).
 *
 * Three values must never be conflated:
 *
 *   incoming MIDI pitch  what the keyboard actually sent
 *   input transpose      correction for hardware/player transposition
 *   concert key          the real key of the song and the pads
 *
 * Input transpose is the only value applied to incoming MIDI. Pad selection
 * uses the concert key directly. There is deliberately no hidden third
 * transpose anywhere in the pipeline.
 */

import { type PitchClass, mod, toPitchClass } from "./pitch";

export const MIN_INPUT_TRANSPOSE = -12;
export const MAX_INPUT_TRANSPOSE = 12;

export function clampInputTranspose(value: number): number {
  return Math.max(MIN_INPUT_TRANSPOSE, Math.min(MAX_INPUT_TRANSPOSE, Math.round(value)));
}

/** Applies input transpose to a raw incoming MIDI note number. */
export function adjustMidiNote(incomingMidiNote: number, inputTranspose: number): number {
  return incomingMidiNote + clampInputTranspose(inputTranspose);
}

/** Pitch class of an incoming note after input transpose. */
export function adjustedPitchClass(incomingMidiNote: number, inputTranspose: number): PitchClass {
  return toPitchClass(adjustMidiNote(incomingMidiNote, inputTranspose));
}

/** Scale degree in semitones of a chord root within the concert key. */
export function nashvilleDegreeSemitones(chordRoot: PitchClass, concertKey: PitchClass): number {
  return mod(chordRoot - concertKey, 12);
}

export const CALIBRATION_REFERENCE_NOTE = 60; // middle C

export type CalibrationSuggestion = {
  receivedNote: number;
  /** Input transpose that would map the received note back to middle C. */
  suggestedTranspose: number;
  /** False when the offset is larger than the supported range. */
  withinRange: boolean;
};

/**
 * Suggests an input transpose from a single "play middle C" observation.
 * Never applied automatically — the user confirms it (spec 11.3).
 */
export function suggestInputTranspose(receivedNote: number): CalibrationSuggestion {
  const rawOffset = CALIBRATION_REFERENCE_NOTE - receivedNote;
  return {
    receivedNote,
    suggestedTranspose: clampInputTranspose(rawOffset),
    withinRange: rawOffset >= MIN_INPUT_TRANSPOSE && rawOffset <= MAX_INPUT_TRANSPOSE,
  };
}
