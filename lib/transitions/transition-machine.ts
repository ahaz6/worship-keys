/**
 * Prepared key transitions (spec section 13).
 *
 *   STOPPED ──start──▶ PLAYING
 *   PLAYING ──prepare──▶ ARMED
 *   ARMED ──cancel──▶ PLAYING
 *   ARMED ──switch now / qualifying chord──▶ TRANSITIONING
 *   TRANSITIONING ──crossfade complete──▶ PLAYING in the target key
 *
 * The automatic trigger is intentionally hard to fire by accident. A leftover
 * sustained chord from the old key, a passing note, or a low-confidence reading
 * must never move the whole band into a different key.
 */

import type { ChordCandidate } from "../music/chord-detector";
import { type Mode, type PitchClass, mod } from "../music/pitch";

export type TransitionState = "stopped" | "playing" | "armed" | "crescendo" | "transitioning";

export type KeySelection = {
  tonic: PitchClass;
  mode: Mode;
};

export type TransitionContext = {
  state: TransitionState;
  current: KeySelection | null;
  target: KeySelection | null;
  /** Performance-clock time at which the target was armed. */
  armedAt: number | null;
  /** Performance-clock time at which the crossfade or crescendo started. */
  startedAt: number | null;
  /** Duration of the running crossfade or crescendo, in seconds. */
  durationSeconds: number;
};

export type TriggerPolicy = {
  /** Beyond the tonic, also accept the target key's 4 and 5 chords. */
  allowAnyTargetKeyChord: boolean;
  /** Minimum detector confidence for an automatic switch. */
  minConfidence: number;
  /** How long the chord must have been the stable reading, in ms. */
  minStableMs: number;
};

export const DEFAULT_TRIGGER_POLICY: TriggerPolicy = {
  // Safest MVP default (spec 13.2): only the target tonic fires the switch.
  allowAnyTargetKeyChord: false,
  minConfidence: 0.72,
  minStableMs: 140,
};

export function createTransitionContext(): TransitionContext {
  return { state: "stopped", current: null, target: null, armedAt: null, startedAt: null, durationSeconds: 0 };
}

export type QualifyingChordInput = {
  candidate: ChordCandidate;
  /** When this chord became the stable reading. */
  stableSince: number;
  /** Whether every sounding note is only held by the sustain pedal. */
  sustainedOnly: boolean;
  now: number;
};

export type QualifyingResult = {
  qualifies: boolean;
  /** Why not, for the diagnostics popover. Null when it qualifies. */
  reason: string | null;
};

/**
 * Decides whether a detected chord may fire a prepared transition.
 * Every rejection carries a reason so the UI can explain itself.
 */
export function evaluateQualifyingChord(
  context: TransitionContext,
  input: QualifyingChordInput,
  policy: TriggerPolicy = DEFAULT_TRIGGER_POLICY,
): QualifyingResult {
  if (context.state !== "armed" && context.state !== "crescendo") {
    return { qualifies: false, reason: "No key is armed" };
  }
  const target = context.target;
  if (!target) return { qualifies: false, reason: "No target key" };

  if (input.candidate.confidence < policy.minConfidence) {
    return { qualifies: false, reason: "Chord is not certain enough" };
  }

  // The chord must have started after arming, otherwise a chord that was
  // already ringing when Prepare was pressed would fire it immediately.
  if (context.armedAt != null && input.stableSince < context.armedAt) {
    return { qualifies: false, reason: "Chord was already sounding before Prepare" };
  }

  if (input.sustainedOnly) {
    return { qualifies: false, reason: "Only sustained notes from the previous key" };
  }

  if (input.now - input.stableSince < policy.minStableMs) {
    return { qualifies: false, reason: "Chord has not settled yet" };
  }

  const degree = mod(input.candidate.root - target.tonic, 12);
  const expectsMinorTonic = target.mode === "minor";
  const isMinorChord = input.candidate.template.third === 3;

  if (degree === 0) {
    // The tonic must actually match the target mode. A G major chord does not
    // confirm a move into G minor.
    if (input.candidate.template.third == null) {
      // sus / power chords are tonally neutral: accept them as the tonic.
      return { qualifies: true, reason: null };
    }
    if (isMinorChord === expectsMinorTonic) return { qualifies: true, reason: null };
    return { qualifies: false, reason: "Tonic quality does not match the target mode" };
  }

  if (policy.allowAnyTargetKeyChord && (degree === 5 || degree === 7)) {
    return { qualifies: true, reason: null };
  }

  return { qualifies: false, reason: "Not the target key's tonic" };
}

/* ------------------------------------------------------------ transitions */

export function startPad(context: TransitionContext, key: KeySelection): TransitionContext {
  return { ...context, state: "playing", current: key, target: null, armedAt: null, startedAt: null };
}

export function stopPad(context: TransitionContext): TransitionContext {
  return { ...context, state: "stopped", target: null, armedAt: null, startedAt: null, durationSeconds: 0 };
}

export function prepare(context: TransitionContext, target: KeySelection, now: number): TransitionContext {
  if (context.state !== "playing" && context.state !== "armed" && context.state !== "crescendo") return context;
  return { ...context, state: "armed", target, armedAt: now };
}

export function cancelPreparation(context: TransitionContext): TransitionContext {
  if (context.state !== "armed" && context.state !== "crescendo") return context;
  return { ...context, state: "playing", target: null, armedAt: null, startedAt: null, durationSeconds: 0 };
}

export function startCrescendo(context: TransitionContext, now: number, durationSeconds: number): TransitionContext {
  if (context.state !== "playing" && context.state !== "armed") return context;
  return { ...context, state: "crescendo", startedAt: now, durationSeconds };
}

export function beginTransition(context: TransitionContext, now: number, durationSeconds: number): TransitionContext {
  if (context.state !== "armed" && context.state !== "crescendo") return context;
  if (!context.target) return context;
  return { ...context, state: "transitioning", startedAt: now, durationSeconds };
}

/** Called when the audio engine reports the crossfade has actually finished. */
export function completeTransition(context: TransitionContext): TransitionContext {
  if (context.state !== "transitioning" || !context.target) return context;
  return {
    ...context,
    state: "playing",
    current: context.target,
    target: null,
    armedAt: null,
    startedAt: null,
    durationSeconds: 0,
  };
}

/** 0-1 progress of a running crossfade or crescendo. */
export function transitionProgress(context: TransitionContext, now: number): number {
  if (context.startedAt == null || context.durationSeconds <= 0) return 0;
  const elapsed = (now - context.startedAt) / 1000;
  return Math.max(0, Math.min(1, elapsed / context.durationSeconds));
}
