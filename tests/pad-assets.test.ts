import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const padRoot = join(process.cwd(), "public", "pads");

describe("final Sound Walls pads", () => {
  it("ships only Sound Walls in all twelve keys with continuous loop seams", () => {
    const manifest = JSON.parse(readFileSync(join(padRoot, "manifest.json"), "utf8"));
    expect(manifest.presets).toHaveLength(1);
    const preset = manifest.presets.find((entry: { id: string }) => entry.id === "sound-walls");
    expect(preset).toMatchObject({ mode: "neutral" });
    expect(preset.keys).toHaveLength(12);
    for (const key of preset.keys) {
      expect(key.tempoVariants).toHaveLength(2);
      expect(key.tempoVariants.map((entry: { maxBpm: number }) => entry.maxBpm)).toEqual([120, 80]);
    }

    for (const directory of ["sound-walls", "sound-walls-slow", "sound-walls-deep-slow"]) {
      const files = readdirSync(join(padRoot, directory)).filter((name) => name.endsWith(".wav"));
      expect(files).toHaveLength(12);
      for (const name of files) {
        const wav = readFileSync(join(padRoot, directory, name));
        const dataOffset = wav.indexOf(Buffer.from("data")) + 8;
        const lastFrame = wav.length - 4;
        const seam = Math.max(
          Math.abs(wav.readInt16LE(dataOffset) - wav.readInt16LE(lastFrame)),
          Math.abs(wav.readInt16LE(dataOffset + 2) - wav.readInt16LE(lastFrame + 2)),
        );

        let derivative = 0;
        let frames = 0;
        for (let offset = dataOffset + 4; offset < lastFrame; offset += 4) {
          derivative += Math.abs(wav.readInt16LE(offset) - wav.readInt16LE(offset - 4));
          frames += 1;
        }
        // Time-stretch windows can make the boundary derivative a little
        // larger than the file average; it must still remain a small,
        // waveform-scale step rather than an audible hard discontinuity.
        expect(seam).toBeLessThan((derivative / frames) * 6);
      }
    }
  });
});
