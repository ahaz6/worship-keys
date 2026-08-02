import { describe, expect, it } from "vitest";

import { detectChord } from "@/lib/music/chord-detector";
import type { PitchClass } from "@/lib/music/pitch";
import {
  DEFAULT_TRIGGER_POLICY,
  beginTransition,
  cancelPreparation,
  completeTransition,
  createTransitionContext,
  evaluateQualifyingChord,
  prepare,
  startCrescendo,
  startPad,
  stopPad,
  transitionProgress,
} from "@/lib/transitions/transition-machine";

/** Root-position triad in a comfortable register. */
function triad(root: PitchClass, quality: "major" | "minor") {
  const third = quality === "major" ? 4 : 3;
  const midi = [60 + root, 60 + root + third, 60 + root + 7];
  return detectChord(midi, { bassMidiNote: midi[0] })!;
}

describe("transition state machine", () => {
  it("follows the documented state path", () => {
    let context = createTransitionContext();
    expect(context.state).toBe("stopped");

    context = startPad(context, { tonic: 0, mode: "major" });
    expect(context.state).toBe("playing");

    context = prepare(context, { tonic: 7, mode: "major" }, 1000);
    expect(context.state).toBe("armed");
    expect(context.target).toEqual({ tonic: 7, mode: "major" });

    context = beginTransition(context, 2000, 4);
    expect(context.state).toBe("transitioning");

    context = completeTransition(context);
    expect(context.state).toBe("playing");
    expect(context.current).toEqual({ tonic: 7, mode: "major" });
    expect(context.target).toBeNull();
  });

  it("returns to playing on cancel without changing the key", () => {
    let context = startPad(createTransitionContext(), { tonic: 0, mode: "major" });
    context = prepare(context, { tonic: 7, mode: "major" }, 1000);
    context = cancelPreparation(context);
    expect(context.state).toBe("playing");
    expect(context.current).toEqual({ tonic: 0, mode: "major" });
    expect(context.target).toBeNull();
  });

  it("cannot arm a key while stopped", () => {
    const context = prepare(createTransitionContext(), { tonic: 7, mode: "major" }, 0);
    expect(context.state).toBe("stopped");
  });

  it("cannot begin a transition without a target", () => {
    const context = beginTransition(startPad(createTransitionContext(), { tonic: 0, mode: "major" }), 0, 4);
    expect(context.state).toBe("playing");
  });

  it("clears the target when the pad is stopped", () => {
    let context = startPad(createTransitionContext(), { tonic: 0, mode: "major" });
    context = prepare(context, { tonic: 7, mode: "major" }, 100);
    context = stopPad(context);
    expect(context.state).toBe("stopped");
    expect(context.target).toBeNull();
  });

  it("reports crossfade progress from the audio duration", () => {
    let context = startPad(createTransitionContext(), { tonic: 0, mode: "major" });
    context = prepare(context, { tonic: 7, mode: "major" }, 0);
    context = beginTransition(context, 1000, 4);
    expect(transitionProgress(context, 1000)).toBe(0);
    expect(transitionProgress(context, 3000)).toBeCloseTo(0.5, 5);
    expect(transitionProgress(context, 9000)).toBe(1);
  });
});

describe("qualifying target chord", () => {
  const armed = prepare(startPad(createTransitionContext(), { tonic: 0, mode: "major" }), { tonic: 7, mode: "major" }, 1000);
  const base = { stableSince: 1200, sustainedOnly: false, now: 1400 };

  it("fires on the target tonic once it has settled", () => {
    const result = evaluateQualifyingChord(armed, { ...base, candidate: triad(7, "major").best! });
    expect(result.qualifies).toBe(true);
  });

  it("ignores chords that were already sounding before Prepare", () => {
    const result = evaluateQualifyingChord(armed, { ...base, candidate: triad(7, "major").best!, stableSince: 900, now: 1500 });
    expect(result).toMatchObject({ qualifies: false, reason: "Chord was already sounding before Prepare" });
  });

  it("ignores notes that are only held by the sustain pedal", () => {
    const result = evaluateQualifyingChord(armed, { ...base, candidate: triad(7, "major").best!, sustainedOnly: true });
    expect(result.qualifies).toBe(false);
  });

  it("waits for the stability window", () => {
    const result = evaluateQualifyingChord(armed, { ...base, candidate: triad(7, "major").best!, now: 1250 });
    expect(result).toMatchObject({ qualifies: false, reason: "Chord has not settled yet" });
  });

  it("does not fire on a passing chord from the target key by default", () => {
    // C major is the 4 of G major — not a trigger under the safe default.
    const result = evaluateQualifyingChord(armed, { ...base, candidate: triad(0, "major").best! });
    expect(result).toMatchObject({ qualifies: false, reason: "Not the target key's tonic" });
  });

  it("accepts 4 and 5 only when the user opts in", () => {
    const policy = { ...DEFAULT_TRIGGER_POLICY, allowAnyTargetKeyChord: true };
    expect(evaluateQualifyingChord(armed, { ...base, candidate: triad(0, "major").best! }, policy).qualifies).toBe(true);
    expect(evaluateQualifyingChord(armed, { ...base, candidate: triad(2, "major").best! }, policy).qualifies).toBe(true);
    // The 6m is still not a confirmation of the new key.
    expect(evaluateQualifyingChord(armed, { ...base, candidate: triad(4, "minor").best! }, policy).qualifies).toBe(false);
  });

  it("refuses a major tonic when a minor target was armed", () => {
    const minorTarget = prepare(startPad(createTransitionContext(), { tonic: 0, mode: "major" }), { tonic: 9, mode: "minor" }, 1000);
    expect(evaluateQualifyingChord(minorTarget, { ...base, candidate: triad(9, "major").best! }).qualifies).toBe(false);
    expect(evaluateQualifyingChord(minorTarget, { ...base, candidate: triad(9, "minor").best! }).qualifies).toBe(true);
  });

  it("rejects a low confidence reading", () => {
    // A bare fifth is deliberately weak evidence.
    const power = detectChord([67, 74], { bassMidiNote: 67 }).best!;
    expect(power.confidence).toBeLessThan(DEFAULT_TRIGGER_POLICY.minConfidence);
    expect(evaluateQualifyingChord(armed, { ...base, candidate: power }).qualifies).toBe(false);
  });

  it("never fires when nothing is armed", () => {
    const playing = startPad(createTransitionContext(), { tonic: 0, mode: "major" });
    expect(evaluateQualifyingChord(playing, { ...base, candidate: triad(7, "major").best! })).toMatchObject({
      qualifies: false,
      reason: "No key is armed",
    });
  });

  it("still fires while a crescendo is running", () => {
    const crescendo = startCrescendo(armed, 1100, 4);
    expect(evaluateQualifyingChord(crescendo, { ...base, candidate: triad(7, "major").best! }).qualifies).toBe(true);
  });
});
