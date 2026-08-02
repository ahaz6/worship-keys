#!/usr/bin/env node
/**
 * Generates the built-in Worship Keys pad packs.
 *
 * Every sample shipped with this project is synthesised here from scratch, so
 * the audio is original work owned by the project and carries no third-party
 * sample licence. No audio is taken from any commercial pad product.
 *
 * Seamless looping is a property of the maths rather than a crossfade at the
 * seam: every partial and every modulator frequency is snapped to an integer
 * multiple of 1 / loopSeconds. After exactly one loop each oscillator has
 * completed a whole number of cycles, so value *and* slope match at the join
 * and the loop is click-free by construction.
 *
 *   node scripts/generate-pads.mjs            # all presets
 *   node scripts/generate-pads.mjs aurora     # one preset
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(root, "public", "pads");

const SAMPLE_RATE = 44100;
const LOOP_SECONDS = 6;
const CHANNELS = 2;
const FRAMES = SAMPLE_RATE * LOOP_SECONDS;
/** Frequency resolution that still loops perfectly: one cycle per loop. */
const BIN = 1 / LOOP_SECONDS;

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Snaps a frequency to the loop grid so it completes whole cycles. */
const snap = (hz) => Math.max(BIN, Math.round(hz / BIN) * BIN);

/** Equal temperament, A4 = 440 Hz. */
const midiToHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Preset definitions.
 *
 * `partials` are relative to the root frequency. `detuneCents` is applied
 * before snapping, which is what gives the slow chorus-like beating without
 * breaking the loop. `lfo` values are in loop-grid multiples.
 */
const PRESETS = [
  {
    id: "aurora",
    name: "Aurora",
    description: "Warm neutral drone. Root, fifth and octave with a soft upper haze.",
    rootMidi: 36,
    peak: 0.5,
    partials: [
      { ratio: 1, gain: 1.0, detuneCents: 0, lfo: 1, depth: 0.1, pan: 0 },
      { ratio: 1, gain: 0.72, detuneCents: 6, lfo: 2, depth: 0.14, pan: -0.55 },
      { ratio: 1, gain: 0.72, detuneCents: -6, lfo: 2, depth: 0.14, pan: 0.55 },
      { ratio: 1.4983, gain: 0.5, detuneCents: 0, lfo: 3, depth: 0.16, pan: -0.3 },
      { ratio: 1.4983, gain: 0.44, detuneCents: 5, lfo: 4, depth: 0.16, pan: 0.35 },
      { ratio: 2, gain: 0.38, detuneCents: 0, lfo: 2, depth: 0.2, pan: 0.15 },
      { ratio: 3, gain: 0.16, detuneCents: -4, lfo: 5, depth: 0.3, pan: -0.45 },
      { ratio: 4, gain: 0.1, detuneCents: 0, lfo: 6, depth: 0.35, pan: 0.4 },
      { ratio: 5.9932, gain: 0.05, detuneCents: 7, lfo: 7, depth: 0.45, pan: -0.2 },
      { ratio: 8, gain: 0.032, detuneCents: 0, lfo: 9, depth: 0.5, pan: 0.25 },
    ],
  },
  {
    id: "cathedral",
    name: "Cathedral",
    description: "Airy and wide. Lifted upper partials for large rooms and quiet moments.",
    rootMidi: 36,
    peak: 0.46,
    partials: [
      { ratio: 1, gain: 0.82, detuneCents: 0, lfo: 1, depth: 0.12, pan: 0 },
      { ratio: 2, gain: 0.66, detuneCents: 4, lfo: 2, depth: 0.16, pan: -0.5 },
      { ratio: 2, gain: 0.62, detuneCents: -4, lfo: 3, depth: 0.16, pan: 0.5 },
      { ratio: 2.9966, gain: 0.34, detuneCents: 0, lfo: 3, depth: 0.22, pan: -0.25 },
      { ratio: 4, gain: 0.3, detuneCents: 6, lfo: 4, depth: 0.24, pan: 0.3 },
      { ratio: 5, gain: 0.17, detuneCents: -5, lfo: 5, depth: 0.3, pan: -0.4 },
      { ratio: 5.9932, gain: 0.13, detuneCents: 0, lfo: 6, depth: 0.34, pan: 0.45 },
      { ratio: 8, gain: 0.09, detuneCents: 5, lfo: 8, depth: 0.4, pan: -0.35 },
      { ratio: 10, gain: 0.05, detuneCents: 0, lfo: 9, depth: 0.5, pan: 0.2 },
      { ratio: 12, gain: 0.03, detuneCents: -6, lfo: 11, depth: 0.55, pan: -0.15 },
    ],
  },
  {
    id: "ground",
    name: "Ground",
    description: "Dark and close. Low fundamental with very little air, for spoken moments.",
    rootMidi: 29,
    peak: 0.54,
    partials: [
      { ratio: 1, gain: 1.0, detuneCents: 0, lfo: 1, depth: 0.08, pan: 0 },
      { ratio: 2, gain: 0.78, detuneCents: 4, lfo: 1, depth: 0.1, pan: -0.4 },
      { ratio: 2, gain: 0.74, detuneCents: -4, lfo: 2, depth: 0.1, pan: 0.4 },
      { ratio: 2.9966, gain: 0.3, detuneCents: 0, lfo: 2, depth: 0.16, pan: 0.2 },
      { ratio: 4, gain: 0.2, detuneCents: 5, lfo: 3, depth: 0.18, pan: -0.3 },
      { ratio: 5, gain: 0.07, detuneCents: 0, lfo: 4, depth: 0.26, pan: 0.35 },
      { ratio: 5.9932, gain: 0.04, detuneCents: -6, lfo: 5, depth: 0.3, pan: -0.2 },
    ],
  },
];

/** Constant-power pan: -1 hard left, 0 centre, +1 hard right. */
function panGains(pan) {
  const angle = ((pan + 1) / 2) * (Math.PI / 2);
  return [Math.cos(angle), Math.sin(angle)];
}

function renderKey(preset, pitchClass) {
  const rootHz = midiToHz(preset.rootMidi + pitchClass);
  const left = new Float64Array(FRAMES);
  const right = new Float64Array(FRAMES);

  for (const partial of preset.partials) {
    const detuned = rootHz * partial.ratio * Math.pow(2, (partial.detuneCents ?? 0) / 1200);
    const frequency = snap(detuned);
    // A fixed but frequency-dependent phase offset keeps partials from all
    // starting at zero, which would produce an audible transient click.
    const phase = (frequency * 7.31) % (Math.PI * 2);
    const lfoHz = (partial.lfo ?? 1) * BIN;
    const lfoPhase = (partial.lfo ?? 1) * 1.7;
    const depth = partial.depth ?? 0;
    const [gainL, gainR] = panGains(partial.pan ?? 0);

    for (let frame = 0; frame < FRAMES; frame += 1) {
      const t = frame / SAMPLE_RATE;
      const envelope = 1 - depth + depth * 0.5 * (1 + Math.sin(2 * Math.PI * lfoHz * t + lfoPhase));
      const value = Math.sin(2 * Math.PI * frequency * t + phase) * partial.gain * envelope;
      left[frame] += value * gainL;
      right[frame] += value * gainR;
    }
  }

  // Normalise to the preset's target peak so every key sits at a comparable
  // perceived loudness and leaves headroom for shimmer and the limiter.
  let peak = 0;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
  }
  const scale = peak > 0 ? preset.peak / peak : 1;

  const pcm = Buffer.alloc(FRAMES * CHANNELS * 2);
  for (let frame = 0; frame < FRAMES; frame += 1) {
    for (const [channel, source] of [left, right].entries()) {
      const sample = Math.max(-1, Math.min(1, source[frame] * scale));
      pcm.writeInt16LE(Math.round(sample * 32767), (frame * CHANNELS + channel) * 2);
    }
  }
  return pcm;
}

function wavFile(pcm) {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * CHANNELS * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(CHANNELS * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const requested = process.argv.slice(2);
const presets = requested.length > 0 ? PRESETS.filter((preset) => requested.includes(preset.id)) : PRESETS;
if (presets.length === 0) {
  console.error(`No matching preset. Available: ${PRESETS.map((preset) => preset.id).join(", ")}`);
  process.exit(1);
}

const manifest = {
  version: 1,
  generatedBy: "scripts/generate-pads.mjs",
  license: "Original synthesis created for Worship Keys. Free to use with this application.",
  sampleRate: SAMPLE_RATE,
  loopSeconds: LOOP_SECONDS,
  presets: [],
};

for (const preset of presets) {
  const directory = join(outputRoot, preset.id);
  mkdirSync(directory, { recursive: true });
  const keys = [];

  for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
    const fileName = `${String(pitchClass).padStart(2, "0")}-${NOTE_NAMES[pitchClass]}.wav`;
    writeFileSync(join(directory, fileName), wavFile(renderKey(preset, pitchClass)));
    keys.push({
      pitchClass,
      note: NOTE_NAMES[pitchClass],
      url: `/pads/${preset.id}/${fileName}`,
      loopStart: 0,
      loopEnd: LOOP_SECONDS,
      gainTrim: 1,
    });
    process.stdout.write(`  ${preset.id} ${NOTE_NAMES[pitchClass]}\r`);
  }

  manifest.presets.push({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    // These drones are built from root, fifth and octave only, with no third,
    // so a single set serves both major and minor keys (spec 8.9 / 27.2).
    mode: "neutral",
    keys,
  });
  console.log(`Rendered preset ${preset.id} (12 keys)`);
}

mkdirSync(outputRoot, { recursive: true });
writeFileSync(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${join(outputRoot, "manifest.json")}`);
