#!/usr/bin/env node
/**
 * Builds the one final Worship Keys pad pack from the owner's Sound Walls.
 *
 * A calm region is extracted from each 30-minute 48 kHz source. The tail is
 * equal-power-crossfaded into the head, yielding a compact, seamless 24-second
 * browser loop while the originals remain untouched on the external SSD.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.WORSHIP_KEYS_SOUND_WALLS ?? "/Volumes/SSD Ahaz/Downloads/[Sound Walls]";
const manifestPath = join(root, "public", "pads", "manifest.json");
const LOOP_SECONDS = 24;
const CROSSFADE_SECONDS = 8;
const SOURCE_START_SECONDS = 300;
const ASSET_VERSION = "natural-slowmo-3";
const renders = [
  { id: "soft-slow", directory: "sound-walls", tempo: 0.85, filter: "atempo=0.85," },
  { id: "gentle-slow", directory: "sound-walls-slow", tempo: 0.65, filter: "atempo=0.65,", maxBpm: 120 },
  { id: "natural-slow", directory: "sound-walls-deep-slow", tempo: 0.5, filter: "atempo=0.5,", maxBpm: 80 },
];

const keys = [
  { pitchClass: 0, sourceNote: "C", note: "C" },
  { pitchClass: 1, sourceNote: "C#", note: "Db" },
  { pitchClass: 2, sourceNote: "D", note: "D" },
  { pitchClass: 3, sourceNote: "Eb", note: "Eb" },
  { pitchClass: 4, sourceNote: "E", note: "E" },
  { pitchClass: 5, sourceNote: "F", note: "F" },
  { pitchClass: 6, sourceNote: "F#", note: "Gb" },
  { pitchClass: 7, sourceNote: "G", note: "G" },
  { pitchClass: 8, sourceNote: "Ab", note: "Ab" },
  { pitchClass: 9, sourceNote: "A", note: "A" },
  { pitchClass: 10, sourceNote: "Bb", note: "Bb" },
  { pitchClass: 11, sourceNote: "B", note: "B" },
];

for (const render of renders) {
  const outputRoot = join(root, "public", "pads", render.directory);
  mkdirSync(outputRoot, { recursive: true });
  for (const key of keys) {
    const input = join(sourceRoot, `[${key.sourceNote}] - Sound Walls.wav`);
    const fileName = `${String(key.pitchClass).padStart(2, "0")}-${key.note}.wav`;
    const output = join(outputRoot, fileName);
    const sourceDuration = (LOOP_SECONDS + CROSSFADE_SECONDS) * render.tempo;
    const sourceEnd = SOURCE_START_SECONDS + sourceDuration;
    const filter = [
      `[0:a]atrim=start=${SOURCE_START_SECONDS}:end=${sourceEnd},asetpts=PTS-STARTPTS,highpass=f=38,lowpass=f=14500,${render.filter}loudnorm=I=-21:TP=-3:LRA=7,asplit=2[long][opening]`,
      `[long]atrim=start=${CROSSFADE_SECONDS}:end=${LOOP_SECONDS + CROSSFADE_SECONDS},asetpts=PTS-STARTPTS[main]`,
      `[opening]atrim=start=0:end=${CROSSFADE_SECONDS},asetpts=PTS-STARTPTS[head]`,
      `[main][head]acrossfade=d=${CROSSFADE_SECONDS}:c1=qsin:c2=qsin[out]`,
    ].join(";");

    const rendered = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        input,
        "-filter_complex",
        filter,
        "-map",
        "[out]",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:a",
        "pcm_s16le",
        output,
      ],
      { stdio: "inherit" },
    );
    if (rendered.status !== 0) process.exit(rendered.status ?? 1);
    console.log(`Prepared Sound Walls · ${render.id} · ${key.note}`);
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = 4;
manifest.generatedBy = "scripts/prepare-sound-walls.mjs";
manifest.license = "Sound Walls is derived exclusively from audio supplied by the project owner.";
manifest.sampleRate = 48000;
manifest.loopSeconds = LOOP_SECONDS;
manifest.presets = [
  {
    id: "sound-walls",
    name: "Sound Wall Pads",
    description: "The final warm, intimate Worship Keys pad with automatic pitch-preserving slow motion for slower songs.",
    mode: "neutral",
    source: "user-provided",
    keys: keys.map((key) => {
      const fileName = `${String(key.pitchClass).padStart(2, "0")}-${key.note}.wav`;
      return {
        pitchClass: key.pitchClass,
        note: key.note,
        url: `/pads/sound-walls/${fileName}?v=${ASSET_VERSION}`,
        loopStart: 0,
        loopEnd: LOOP_SECONDS,
        gainTrim: 0.9,
        tempoVariants: renders
          .filter((render) => render.maxBpm != null)
          .map((render) => ({
            maxBpm: render.maxBpm,
            url: `/pads/${render.directory}/${fileName}?v=${ASSET_VERSION}`,
            loopStart: 0,
            loopEnd: LOOP_SECONDS,
            gainTrim: 0.9,
          })),
      };
    }),
  },
];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Updated ${manifestPath}`);
