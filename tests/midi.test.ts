import { describe, expect, it } from "vitest";

import { ActiveNotes } from "@/lib/midi/active-notes";
import { CC_ALL_NOTES_OFF, CC_SUSTAIN, parseMidiMessage } from "@/lib/midi/midi-parser";
import { ChordStabilizer } from "@/lib/music/chord-stabilizer";
import { suggestInputTranspose } from "@/lib/music/transpose";

describe("midi message parsing", () => {
  it("parses note on and note off", () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({ type: "note-on", note: 60, velocity: 100, channel: 0 });
    expect(parseMidiMessage([0x80, 60, 0])).toEqual({ type: "note-off", note: 60, channel: 0 });
  });

  it("treats note on with velocity 0 as note off", () => {
    expect(parseMidiMessage([0x90, 64, 0])).toEqual({ type: "note-off", note: 64, channel: 0 });
  });

  it("keeps the channel nibble", () => {
    expect(parseMidiMessage([0x93, 60, 90])).toMatchObject({ channel: 3 });
  });

  it("parses the sustain pedal as a switch at 64", () => {
    expect(parseMidiMessage([0xb0, CC_SUSTAIN, 127])).toEqual({ type: "sustain", down: true, channel: 0 });
    expect(parseMidiMessage([0xb0, CC_SUSTAIN, 64])).toEqual({ type: "sustain", down: true, channel: 0 });
    expect(parseMidiMessage([0xb0, CC_SUSTAIN, 63])).toEqual({ type: "sustain", down: false, channel: 0 });
    expect(parseMidiMessage([0xb0, CC_SUSTAIN, 0])).toEqual({ type: "sustain", down: false, channel: 0 });
  });

  it("parses all notes off and ignores other controllers", () => {
    expect(parseMidiMessage([0xb0, CC_ALL_NOTES_OFF, 0])).toEqual({ type: "all-notes-off", channel: 0 });
    expect(parseMidiMessage([0xb0, 7, 100])).toBeNull();
    expect(parseMidiMessage([0xf8])).toBeNull();
  });
});

describe("active note state", () => {
  it("tracks sounding notes and the bass note", () => {
    const notes = new ActiveNotes();
    notes.noteOn(67, 90, 0, 0);
    notes.noteOn(52, 90, 0, 1);
    notes.noteOn(60, 90, 0, 2);
    const snapshot = notes.snapshot();
    expect(snapshot.sounding).toEqual([52, 60, 67]);
    expect(snapshot.bassNote).toBe(52);
    expect(snapshot.lastNoteOnAt).toBe(2);
  });

  it("requires as many note offs as note ons for a repeated note", () => {
    const notes = new ActiveNotes();
    notes.noteOn(60, 90, 0, 0);
    notes.noteOn(60, 90, 0, 10);
    notes.noteOff(60);
    expect(notes.snapshot().sounding).toEqual([60]);
    notes.noteOff(60);
    expect(notes.snapshot().sounding).toEqual([]);
  });

  it("keeps released notes sounding while the sustain pedal is down", () => {
    const notes = new ActiveNotes();
    notes.setSustain(true);
    notes.noteOn(60, 90, 0, 0);
    notes.noteOff(60);
    let snapshot = notes.snapshot();
    expect(snapshot.sounding).toEqual([60]);
    expect(snapshot.pressed).toEqual([]);
    expect(snapshot.sustained).toEqual([60]);

    notes.setSustain(false);
    snapshot = notes.snapshot();
    expect(snapshot.sounding).toEqual([]);
  });

  it("keeps still-pressed notes when the pedal is released", () => {
    const notes = new ActiveNotes();
    notes.noteOn(60, 90, 0, 0);
    notes.setSustain(true);
    notes.noteOn(64, 90, 0, 1);
    notes.noteOff(64);
    notes.setSustain(false);
    expect(notes.snapshot().sounding).toEqual([60]);
  });

  it("clears everything including a stuck pedal on device disconnect", () => {
    const notes = new ActiveNotes();
    notes.setSustain(true);
    notes.noteOn(60, 90, 0, 0);
    notes.noteOn(64, 90, 0, 0);
    notes.reset();
    expect(notes.snapshot().sounding).toEqual([]);
    expect(notes.isSustainDown).toBe(false);
  });

  it("clears sounding notes on all notes off but keeps the pedal state", () => {
    const notes = new ActiveNotes();
    notes.setSustain(true);
    notes.noteOn(60, 90, 0, 0);
    notes.allNotesOff();
    expect(notes.snapshot().sounding).toEqual([]);
    expect(notes.isSustainDown).toBe(true);
  });
});

describe("chord stabilizer", () => {
  it("waits for the gather window before reporting a new chord", () => {
    const stabilizer = new ChordStabilizer({ gatherMs: 60 });
    expect(stabilizer.update([60, 64], 0)).toBeNull();
    expect(stabilizer.update([60, 64, 67], 20)).toBeNull();
    expect(stabilizer.update([60, 64, 67], 50)).toBeNull();
    const stable = stabilizer.update([60, 64, 67], 90);
    expect(stable?.candidate.root).toBe(0);
    expect(stable?.candidate.quality).toBe("maj");
  });

  it("does not flicker when a note is released for 20 ms", () => {
    const stabilizer = new ChordStabilizer({ gatherMs: 60, releaseMs: 90 });
    stabilizer.update([60, 64, 67], 0);
    const stable = stabilizer.update([60, 64, 67], 100);
    expect(stable?.candidate.root).toBe(0);

    // Everything lifts for 20 ms, then the same chord comes back.
    expect(stabilizer.update([], 110)?.candidate.root).toBe(0);
    expect(stabilizer.update([60, 64, 67], 130)?.candidate.root).toBe(0);
  });

  it("clears once the keyboard has been empty past the release window", () => {
    const stabilizer = new ChordStabilizer({ gatherMs: 60, releaseMs: 90 });
    stabilizer.update([60, 64, 67], 0);
    stabilizer.update([60, 64, 67], 100);
    expect(stabilizer.update([], 110)).not.toBeNull();
    expect(stabilizer.update([], 250)).toBeNull();
  });

  it("keeps the previous chord while an arpeggio passes through", () => {
    const stabilizer = new ChordStabilizer({ gatherMs: 60 });
    stabilizer.update([55, 59, 62], 0);
    const settled = stabilizer.update([55, 59, 62], 100);
    expect(settled?.candidate.root).toBe(7);

    // A quick passing voicing that never survives the gather window.
    expect(stabilizer.update([55, 59, 62, 64], 110)?.candidate.root).toBe(7);
    expect(stabilizer.update([55, 59, 62], 130)?.candidate.root).toBe(7);
  });

  it("reports the time a chord became stable", () => {
    const stabilizer = new ChordStabilizer({ gatherMs: 60 });
    stabilizer.update([60, 64, 67], 1000);
    const stable = stabilizer.update([60, 64, 67], 1070);
    expect(stable?.since).toBe(1070);
  });
});

describe("input calibration", () => {
  it("suggests the transpose that maps the received note back to middle C", () => {
    expect(suggestInputTranspose(58)).toMatchObject({ suggestedTranspose: 2, withinRange: true });
    expect(suggestInputTranspose(62)).toMatchObject({ suggestedTranspose: -2, withinRange: true });
    expect(suggestInputTranspose(60)).toMatchObject({ suggestedTranspose: 0, withinRange: true });
  });

  it("flags an implausible offset instead of silently clamping", () => {
    const suggestion = suggestInputTranspose(36);
    expect(suggestion.withinRange).toBe(false);
    expect(suggestion.suggestedTranspose).toBe(12);
  });
});
