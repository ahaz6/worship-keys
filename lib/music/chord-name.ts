/**
 * Human-readable chord labels, e.g. `Gsus4`, `D/F#`, `Bbm7`.
 * Spelling is delegated to notation.ts so one preference governs everything.
 */

import type { ChordCandidate } from "./chord-detector";
import { CHORD_TEMPLATES, type ChordQuality } from "./chord-templates";
import { type SpellingContext, spellPitchClass } from "./notation";
import type { PitchClass } from "./pitch";

export function chordName(
  root: PitchClass,
  quality: ChordQuality,
  context: SpellingContext,
  bass: PitchClass | null = null,
): string {
  const suffix = CHORD_TEMPLATES.find((template) => template.quality === quality)?.suffix ?? "";
  const base = `${spellPitchClass(root, context)}${suffix}`;
  if (bass == null || bass === root) return base;
  return `${base}/${spellPitchClass(bass, context)}`;
}

export function chordNameForCandidate(candidate: ChordCandidate, context: SpellingContext): string {
  return chordName(candidate.root, candidate.quality, context, candidate.bass);
}
