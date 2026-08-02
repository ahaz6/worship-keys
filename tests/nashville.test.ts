import { describe, expect, it } from "vitest";

import { detectChord } from "@/lib/music/chord-detector";
import { chordNameForCandidate } from "@/lib/music/chord-name";
import { CHORD_TEMPLATES } from "@/lib/music/chord-templates";
import {
  nashvilleForCandidate,
  simpleBassNumberForCandidate,
  simpleBassNumberForMidiNote,
  toNashville,
} from "@/lib/music/nashville";
import { parseNoteName, spellKeyShort } from "@/lib/music/notation";
import { PITCH_CLASSES, type Mode, type PitchClass } from "@/lib/music/pitch";
import { adjustMidiNote } from "@/lib/music/transpose";

/** Turns note names into MIDI numbers in a sensible keyboard register. */
function notes(spelled: string, startOctave = 4): number[] {
  let previous = -1;
  let octave = startOctave;
  return spelled.split(/\s+/).map((name) => {
    const pitchClass = parseNoteName(name);
    if (pitchClass == null) throw new Error(`Bad note name: ${name}`);
    if (pitchClass < previous) octave += 1;
    previous = pitchClass;
    return (octave + 1) * 12 + pitchClass;
  });
}

describe("mandatory Nashville test cases (spec 12.4)", () => {
  const cases: {
    key: string;
    mode: Mode;
    played: number[];
    transpose?: number;
    chord: string;
    nashville: string;
  }[] = [
    { key: "C", mode: "major", played: notes("C E G"), chord: "C", nashville: "1" },
    { key: "C", mode: "major", played: notes("D F A"), chord: "Dm", nashville: "2m" },
    { key: "G", mode: "major", played: notes("D F# A"), chord: "D", nashville: "5" },
    { key: "Bb", mode: "major", played: notes("F A C"), chord: "F", nashville: "5" },
    { key: "D", mode: "minor", played: notes("F A C"), chord: "F", nashville: "♭3" },
    { key: "A", mode: "major", played: notes("E G# B D"), chord: "E7", nashville: "57" },
    // Keyboard sends C E G while transposed down a tone; +2 restores concert D.
    { key: "G", mode: "major", played: notes("C E G"), transpose: 2, chord: "D", nashville: "5" },
    { key: "E", mode: "major", played: [51, 59, 63, 66], chord: "B/D#", nashville: "5/7" },
  ];

  for (const testCase of cases) {
    it(`${testCase.key} ${testCase.mode}: ${testCase.chord} is ${testCase.nashville}`, () => {
      const keyTonic = parseNoteName(testCase.key) as PitchClass;
      const adjusted = testCase.played.map((note) => adjustMidiNote(note, testCase.transpose ?? 0));
      const detection = detectChord(adjusted, {
        bassMidiNote: Math.min(...adjusted),
        keyTonic,
        keyMode: testCase.mode,
      });

      expect(detection.best).not.toBeNull();
      const best = detection.best!;
      expect(chordNameForCandidate(best, { preference: "auto", keyTonic, keyMode: testCase.mode })).toBe(testCase.chord);
      expect(nashvilleForCandidate(best, keyTonic).text).toBe(testCase.nashville);
    });
  }
});

describe("all 12 roots x major/minor triads", () => {
  it("names every triad correctly in root position", () => {
    for (const root of PITCH_CLASSES) {
      for (const mode of ["major", "minor"] as const) {
        const third = mode === "major" ? 4 : 3;
        const midi = [60 + root, 60 + root + third, 60 + root + 7];
        const detection = detectChord(midi, { bassMidiNote: midi[0] });
        expect(detection.best?.root, `root ${root} ${mode}`).toBe(root);
        expect(detection.best?.quality, `quality ${root} ${mode}`).toBe(mode === "major" ? "maj" : "min");
      }
    }
  });
});

describe("all 12 concert keys x diatonic degrees", () => {
  const majorDegrees = [
    { semitones: 0, nashville: "1" },
    { semitones: 2, nashville: "2m" },
    { semitones: 4, nashville: "3m" },
    { semitones: 5, nashville: "4" },
    { semitones: 7, nashville: "5" },
    { semitones: 9, nashville: "6m" },
    { semitones: 11, nashville: "7°" },
  ];
  const majorThirds = [4, 3, 3, 4, 4, 3, 3];
  const minorDegrees = [
    { semitones: 0, nashville: "1m" },
    { semitones: 2, nashville: "2°" },
    { semitones: 3, nashville: "♭3" },
    { semitones: 5, nashville: "4m" },
    { semitones: 7, nashville: "5m" },
    { semitones: 8, nashville: "♭6" },
    { semitones: 10, nashville: "♭7" },
  ];
  const minorThirds = [3, 3, 4, 3, 3, 4, 4];

  it("maps every diatonic triad of every major key", () => {
    for (const tonic of PITCH_CLASSES) {
      majorDegrees.forEach((degree, index) => {
        const root = ((tonic + degree.semitones) % 12) as PitchClass;
        const third = majorThirds[index] as number;
        const fifth = index === 6 ? 6 : 7; // vii° has a diminished fifth
        const midi = [60 + root, 60 + root + third, 60 + root + fifth];
        const detection = detectChord(midi, { bassMidiNote: midi[0], keyTonic: tonic, keyMode: "major" });
        expect(detection.best?.root).toBe(root);
        expect(nashvilleForCandidate(detection.best!, tonic).text).toBe(degree.nashville);
      });
    }
  });

  it("maps every diatonic triad of every natural minor key", () => {
    for (const tonic of PITCH_CLASSES) {
      minorDegrees.forEach((degree, index) => {
        const root = ((tonic + degree.semitones) % 12) as PitchClass;
        const third = minorThirds[index] as number;
        const fifth = index === 1 ? 6 : 7; // ii° has a diminished fifth
        const midi = [60 + root, 60 + root + third, 60 + root + fifth];
        const detection = detectChord(midi, { bassMidiNote: midi[0], keyTonic: tonic, keyMode: "minor" });
        expect(detection.best?.root).toBe(root);
        expect(nashvilleForCandidate(detection.best!, tonic).text).toBe(degree.nashville);
      });
    }
  });
});

describe("chromatic and borrowed chords stay honest", () => {
  it("reports a played major chord as major even when the key expects minor", () => {
    // D major in C major must read "2", never "2m".
    const detection = detectChord([62, 66, 69], { bassMidiNote: 62, keyTonic: 0, keyMode: "major" });
    expect(nashvilleForCandidate(detection.best!, 0).text).toBe("2");
  });

  it("names a borrowed ♭7 chord in a major key", () => {
    // Bb major in C major.
    const detection = detectChord([58, 62, 65], { bassMidiNote: 58, keyTonic: 0, keyMode: "major" });
    expect(nashvilleForCandidate(detection.best!, 0).text).toBe("♭7");
  });

  it("keeps the tritone degree spelling tied to the notation preference", () => {
    expect(toNashville(6, "maj", 0, { preference: "sharps" }).degree).toBe("♯4");
    expect(toNashville(6, "maj", 0, { preference: "flats" }).degree).toBe("♭5");
  });

  it("simplifies extensions in live mode but keeps the minor marker", () => {
    expect(toNashville(2, "min7", 0, { simplified: true }).text).toBe("2m");
    expect(toNashville(2, "min7", 0).text).toBe("2m7");
  });
});

describe("input transpose across the full range", () => {
  it("keeps Nashville numbers correct for every transpose value", () => {
    // A physical C major triad, with the hardware transposed by every amount.
    for (let transpose = -12; transpose <= 12; transpose += 1) {
      const raw = [60, 64, 67];
      const adjusted = raw.map((note) => adjustMidiNote(note, transpose));
      const expectedRoot = (((transpose % 12) + 12) % 12) as PitchClass;
      const detection = detectChord(adjusted, { bassMidiNote: Math.min(...adjusted) });
      expect(detection.best?.root, `transpose ${transpose}`).toBe(expectedRoot);
      // Relative to a concert key that moves with it, the number never changes.
      expect(nashvilleForCandidate(detection.best!, expectedRoot).text).toBe("1");
    }
  });
});

describe("enharmonic spelling", () => {
  it("prefers flats in flat keys and sharps in sharp keys", () => {
    expect(spellKeyShort(10, "major")).toBe("Bb");
    expect(spellKeyShort(6, "major")).toBe("Gb");
    expect(spellKeyShort(1, "major")).toBe("Db");
    expect(spellKeyShort(2, "major")).toBe("D");
    expect(spellKeyShort(6, "minor")).toBe("F#m");
    expect(spellKeyShort(1, "minor")).toBe("C#m");
  });

  it("honours an explicit preference over the key", () => {
    expect(spellKeyShort(10, "major", "sharps")).toBe("A#");
    expect(spellKeyShort(6, "major", "flats")).toBe("Gb");
  });
});

describe("chord vocabulary", () => {
  it("detects every template in root position", () => {
    for (const template of CHORD_TEMPLATES) {
      const midi = template.intervals.map((interval) => 60 + interval);
      const detection = detectChord(midi, { bassMidiNote: 60 });
      expect(detection.best?.quality, template.quality).toBe(template.quality);
      expect(detection.best?.root).toBe(0);
    }
  });

  it("marks a power chord as lower confidence than a full triad", () => {
    const power = detectChord([60, 67], { bassMidiNote: 60 });
    const triad = detectChord([60, 64, 67], { bassMidiNote: 60 });
    expect(power.best!.confidence).toBeLessThan(triad.best!.confidence);
  });

  it("reports an inversion with its bass note", () => {
    // First-inversion C major: E in the bass.
    const detection = detectChord([52, 60, 67], { bassMidiNote: 52 });
    expect(detection.best?.root).toBe(0);
    expect(detection.best?.bass).toBe(4);
    expect(nashvilleForCandidate(detection.best!, 0).text).toBe("1/3");
    expect(simpleBassNumberForCandidate(detection.best!, 0)).toBe("3");
  });

  it("shows only 1–7 for the lowest note while keeping chromatic detail out of the stage number", () => {
    const borrowed = detectChord([58, 62, 65], { bassMidiNote: 58, keyTonic: 0, keyMode: "major" });
    expect(nashvilleForCandidate(borrowed.best!, 0).text).toBe("♭7");
    expect(simpleBassNumberForCandidate(borrowed.best!, 0)).toBe("7");

    const sharpFourBass = detectChord([54, 60, 64], { bassMidiNote: 54, keyTonic: 0, keyMode: "major" });
    expect(simpleBassNumberForCandidate(sharpFourBass.best!, 0)).toBe("4");
  });

  it("returns nothing for a single note", () => {
    expect(detectChord([60]).best).toBeNull();
  });
});

describe("bass-led live Nashville display", () => {
  it("keeps the low root while the right hand plays changing melody notes", () => {
    const keyTonic = parseNoteName("C") as PitchClass;
    const lowBass = 36; // C2
    const highMelody = [76, 79, 81, 83]; // E5, G5, A5, B5

    for (const melodyNote of highMelody) {
      const sounding = [lowBass, melodyNote];
      expect(simpleBassNumberForMidiNote(Math.min(...sounding), keyTonic)).toBe("1");
    }
  });

  it("maps the low fifth independently of a dense high voicing", () => {
    const keyTonic = parseNoteName("C") as PitchClass;
    const sounding = [43, 72, 74, 76, 79]; // G2 below a C-D-E-G melody cluster
    expect(simpleBassNumberForMidiNote(Math.min(...sounding), keyTonic)).toBe("5");
  });

  it("returns the same number for every octave of the same bass note", () => {
    const keyTonic = parseNoteName("D") as PitchClass;
    for (const d of [26, 38, 50, 62, 74, 86]) {
      expect(simpleBassNumberForMidiNote(d, keyTonic)).toBe("1");
    }
  });

  it("shows a bass number even before enough notes exist to name a chord", () => {
    expect(detectChord([48], { bassMidiNote: 48 }).best).toBeNull();
    expect(simpleBassNumberForMidiNote(48, 0)).toBe("1");
  });
});
