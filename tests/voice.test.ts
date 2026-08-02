import { describe, expect, it } from "vitest";

import { WAKE_WORD, isImmediateCommand, isSpokenCountdown, parseVoiceCommand } from "@/lib/voice/command-parser";

const confident = 0.9;

describe("voice command parsing", () => {
  it("parses a prepared key", () => {
    const parsed = parseVoiceCommand("Prepare G", confident);
    expect(parsed?.command).toEqual({ type: "prepare", tonic: 7, mode: "major" });
    expect(parsed?.label).toBe("PREPARE G");
  });

  it("parses a prepared minor key", () => {
    expect(parseVoiceCommand("Prepare G minor", confident)?.command).toEqual({
      type: "prepare",
      tonic: 7,
      mode: "minor",
    });
  });

  it("understands spoken accidentals", () => {
    expect(parseVoiceCommand("Prepare B flat", confident)?.command).toEqual({ type: "prepare", tonic: 10, mode: "major" });
    expect(parseVoiceCommand("prepare f sharp minor", confident)?.command).toEqual({
      type: "prepare",
      tonic: 6,
      mode: "minor",
    });
  });

  it("parses the transport commands", () => {
    expect(parseVoiceCommand("Key switch", confident)?.command).toEqual({ type: "switch-now" });
    expect(parseVoiceCommand("Switch now", confident)?.command).toEqual({ type: "switch-now" });
    expect(parseVoiceCommand("Crescendo", confident)?.command).toEqual({ type: "crescendo" });
    expect(parseVoiceCommand("Cancel transition", confident)?.command).toEqual({ type: "cancel-transition" });
    expect(parseVoiceCommand("Stop pads", confident)?.command).toEqual({ type: "stop-pads" });
    expect(parseVoiceCommand("Next song", confident)?.command).toEqual({ type: "next-song" });
    expect(parseVoiceCommand("Previous song", confident)?.command).toEqual({ type: "previous-song" });
  });

  it("ignores ordinary speech", () => {
    expect(parseVoiceCommand("we are going to the bridge now", confident)).toBeNull();
    expect(parseVoiceCommand("thank you all for coming this morning", confident)).toBeNull();
    expect(parseVoiceCommand("prepare your hearts", confident)).toBeNull();
  });

  it("holds a low confidence command instead of running it", () => {
    const parsed = parseVoiceCommand("Prepare G", 0.3);
    expect(parsed?.actionable).toBe(false);
    expect(parsed?.hold).toContain("confident");
  });

  it("recognises the wake word and strips it", () => {
    const parsed = parseVoiceCommand(`${WAKE_WORD} prepare A minor`, confident);
    expect(parsed?.wakeWord).toBe(true);
    expect(parsed?.command).toEqual({ type: "prepare", tonic: 9, mode: "minor" });
  });

  it("holds commands without the wake word when the wake word is required", () => {
    const options = { requireWakeWord: true };
    expect(parseVoiceCommand("Crescendo", confident, options)?.actionable).toBe(false);
    expect(parseVoiceCommand(`${WAKE_WORD} crescendo`, confident, options)?.actionable).toBe(true);
  });

  it("is case and punctuation tolerant", () => {
    expect(parseVoiceCommand("PREPARE, E FLAT!", confident)?.command).toEqual({
      type: "prepare",
      tonic: 3,
      mode: "major",
    });
  });

  it("marks stop and cancel as immediately actionable", () => {
    expect(isImmediateCommand({ type: "stop-pads" })).toBe(true);
    expect(isImmediateCommand({ type: "cancel-transition" })).toBe(true);
    expect(isImmediateCommand({ type: "prepare", tonic: 0, mode: "major" })).toBe(true);
    // Switching the whole band's key is never automatic from a single phrase.
    expect(isImmediateCommand({ type: "switch-now" })).toBe(false);
    expect(isImmediateCommand({ type: "next-song" })).toBe(false);
  });

  it("recognises a complete MD countdown in digits, English and German", () => {
    expect(isSpokenCountdown("3, 2, 1")).toBe(true);
    expect(isSpokenCountdown("three two one, go")).toBe(true);
    expect(isSpokenCountdown("Drei – zwei – eins!")).toBe(true);
  });

  it("does not release a crescendo for partial or reversed numbers", () => {
    expect(isSpokenCountdown("three, two")).toBe(false);
    expect(isSpokenCountdown("one two three")).toBe(false);
    expect(isSpokenCountdown("we need three people in two minutes")).toBe(false);
  });
});
