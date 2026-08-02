/**
 * Turns a stream of raw note-set changes into a calm chord readout
 * (spec section 9.3).
 *
 * Keyboard players do not strike notes sample-accurately, and they let go of a
 * note for 20 ms without meaning anything by it. Two windows handle that:
 *
 *   gatherMs   how long a new note set must persist before it is shown
 *   releaseMs  how long an emptied keyboard is tolerated before clearing
 *
 * Time is passed in rather than read from a clock, so the behaviour is fully
 * testable without timers.
 */

import { type ChordCandidate, type ChordDetection, type DetectionContext, detectChord } from "./chord-detector";

export type StabilizerOptions = {
  gatherMs?: number;
  releaseMs?: number;
};

export type StableChord = {
  candidate: ChordCandidate;
  detection: ChordDetection;
  /** Performance-clock time at which this chord became the accepted reading. */
  since: number;
  /** Sounding notes that produced it. */
  notes: number[];
};

const DEFAULT_GATHER_MS = 60;
const DEFAULT_RELEASE_MS = 90;

function sameNotes(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((note, index) => note === b[index]);
}

export class ChordStabilizer {
  private readonly gatherMs: number;
  private readonly releaseMs: number;

  private accepted: StableChord | null = null;
  private pendingNotes: number[] = [];
  private pendingSince = 0;
  private emptySince: number | null = null;

  constructor(options: StabilizerOptions = {}) {
    this.gatherMs = options.gatherMs ?? DEFAULT_GATHER_MS;
    this.releaseMs = options.releaseMs ?? DEFAULT_RELEASE_MS;
  }

  get current(): StableChord | null {
    return this.accepted;
  }

  reset(): void {
    this.accepted = null;
    this.pendingNotes = [];
    this.pendingSince = 0;
    this.emptySince = null;
  }

  /**
   * Feeds the current sounding notes. Returns the chord that should be shown,
   * which may still be the previous one while a new set settles.
   */
  update(soundingNotes: readonly number[], now: number, context: DetectionContext = {}): StableChord | null {
    const notes = [...soundingNotes].sort((a, b) => a - b);

    if (notes.length < 2) {
      // Hold the last reading briefly so a quick re-voicing does not blank out.
      if (this.accepted == null) return null;
      this.emptySince ??= now;
      if (now - this.emptySince >= this.releaseMs) {
        this.reset();
        return null;
      }
      return this.accepted;
    }

    this.emptySince = null;

    if (!sameNotes(notes, this.pendingNotes)) {
      this.pendingNotes = notes;
      this.pendingSince = now;
    }

    // Nothing changes until the new voicing has held still long enough.
    if (now - this.pendingSince < this.gatherMs) return this.accepted;

    const alreadyAccepted = this.accepted != null && sameNotes(notes, this.accepted.notes);
    if (alreadyAccepted) return this.accepted;

    const detection = detectChord(notes, {
      ...context,
      previousRoot: context.previousRoot ?? this.accepted?.candidate.root ?? null,
      previousQuality: context.previousQuality ?? this.accepted?.candidate.quality ?? null,
    });

    if (!detection.best) {
      // Unrecognisable voicing: keep showing the last confident reading.
      return this.accepted;
    }

    this.accepted = { candidate: detection.best, detection, since: now, notes };
    return this.accepted;
  }
}
