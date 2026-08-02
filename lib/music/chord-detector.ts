/**
 * Chord detection from sounding pitch classes (spec section 10).
 *
 * The detector is deliberately conservative: it would rather report
 * `Ambiguous` with two candidates than confidently name the wrong chord in
 * front of a congregation. The active concert key is only a weak tiebreaker —
 * a borrowed or chromatic chord must still be reported as what it is.
 */

import { CHORD_TEMPLATES, type ChordQuality, type ChordTemplate } from "./chord-templates";
import { type Mode, type PitchClass, mod, toPitchClass } from "./pitch";

export type ChordCandidate = {
  root: PitchClass;
  quality: ChordQuality;
  template: ChordTemplate;
  /** Lowest sounding pitch class, when it differs from the root. */
  bass: PitchClass | null;
  score: number;
  /** 0-1, comparable across detections. */
  confidence: number;
};

export type ChordDetection = {
  best: ChordCandidate | null;
  /** Best first, at most three, for the "ambiguous" display. */
  candidates: ChordCandidate[];
  /** True when the top two candidates are too close to call. */
  ambiguous: boolean;
};

export type DetectionContext = {
  /** Lowest sounding MIDI note, already input-transposed. */
  bassMidiNote?: number | null;
  /** Previous accepted root, used as a mild stability factor. */
  previousRoot?: PitchClass | null;
  previousQuality?: ChordQuality | null;
  /** Active concert key, used only as a weak plausibility nudge. */
  keyTonic?: PitchClass | null;
  keyMode?: Mode | null;
};

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/** Two candidates within this score gap are reported as ambiguous. */
const AMBIGUITY_GAP = 0.05;

function isDiatonic(pitchClass: PitchClass, tonic: PitchClass, mode: Mode): boolean {
  const scale = mode === "major" ? MAJOR_SCALE : NATURAL_MINOR_SCALE;
  return scale.includes(mod(pitchClass - tonic, 12));
}

function scoreCandidate(
  root: PitchClass,
  template: ChordTemplate,
  sounding: ReadonlySet<PitchClass>,
  context: DetectionContext,
): ChordCandidate | null {
  const templatePitches = template.intervals.map((interval) => toPitchClass(root + interval));
  const essentialPitches = template.essential.map((interval) => toPitchClass(root + interval));

  for (const pitch of essentialPitches) {
    if (!sounding.has(pitch)) return null;
  }

  const matched = templatePitches.filter((pitch) => sounding.has(pitch));
  const missing = templatePitches.length - matched.length;
  const templateSet = new Set(templatePitches);
  const extras = [...sounding].filter((pitch) => !templateSet.has(pitch));

  // Coverage of the template drives the base score.
  let score = template.weight * (matched.length / templatePitches.length);

  // A missing non-essential tone (usually the fifth) is only a light penalty.
  score -= missing * 0.06;

  // Extra tones cost more when they sit outside the key than inside it.
  for (const extra of extras) {
    const diatonic =
      context.keyTonic != null && context.keyMode != null && isDiatonic(extra, context.keyTonic, context.keyMode);
    score -= diatonic ? 0.1 : 0.16;
  }

  // Bass handling: root position is the strongest reading, a chord tone in the
  // bass is a normal inversion, anything else is suspicious.
  let bass: PitchClass | null = null;
  if (context.bassMidiNote != null) {
    const bassPitch = toPitchClass(context.bassMidiNote);
    if (bassPitch === root) {
      score += 0.14;
    } else if (templateSet.has(bassPitch)) {
      score += 0.03;
      bass = bassPitch;
    } else {
      score -= 0.1;
      bass = bassPitch;
    }
  }

  // Repeating the previous chord is more likely than a same-instant re-analysis.
  if (context.previousRoot === root) {
    score += 0.05;
    if (context.previousQuality === template.quality) score += 0.02;
  }

  // Weak key context. Small enough that a real chromatic chord still wins.
  if (context.keyTonic != null && context.keyMode != null && isDiatonic(root, context.keyTonic, context.keyMode)) {
    score += 0.03;
  }

  return { root, quality: template.quality, template, bass, score, confidence: 0 };
}

/**
 * Detects the most plausible chord for a set of sounding MIDI notes.
 * Notes must already have input transpose applied.
 */
export function detectChord(soundingMidiNotes: readonly number[], context: DetectionContext = {}): ChordDetection {
  const sounding = new Set<PitchClass>(soundingMidiNotes.map((note) => toPitchClass(note)));
  if (sounding.size < 2) {
    return { best: null, candidates: [], ambiguous: false };
  }

  const candidates: ChordCandidate[] = [];
  for (const root of sounding) {
    for (const template of CHORD_TEMPLATES) {
      const candidate = scoreCandidate(root, template, sounding, context);
      if (candidate && candidate.score > 0) candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    return { best: null, candidates: [], ambiguous: false };
  }

  candidates.sort((a, b) => b.score - a.score);

  // Confidence is the leader's score relative to a perfect root-position match,
  // reduced when a rival is close behind.
  const top = candidates[0] as ChordCandidate;
  const runnerUp = candidates[1];
  const margin = runnerUp ? top.score - runnerUp.score : top.score;
  const clarity = Math.min(1, margin / 0.2);
  const strength = Math.min(1, top.score / 1.16);
  const confidence = Math.max(0, Math.min(1, strength * (0.55 + 0.45 * clarity)));

  const ranked = candidates.slice(0, 3).map((candidate) => ({
    ...candidate,
    confidence: candidate === top ? confidence : Math.max(0, Math.min(1, candidate.score / 1.16) * 0.6),
  }));

  return {
    best: ranked[0] ?? null,
    candidates: ranked,
    ambiguous: runnerUp != null && margin < AMBIGUITY_GAP,
  };
}
