import { describe, expect, it } from "vitest";

import {
  CURVE_POINTS,
  equalPowerPair,
  estimateCurveValue,
  fadeCurve,
  gainToVolumePercent,
  volumePercentToGain,
} from "@/lib/audio/crossfade";
import {
  PAD_LIMITS,
  PadEngine,
  brightnessPercentToDb,
  motionFrequencyForPercent,
  motionBarsForPercent,
  tempoSyncedMotionFrequency,
  widthPercentToSideGain,
} from "@/lib/audio/pad-engine";

describe("equal-power crossfade", () => {
  it("keeps constant power across the whole crossfade", () => {
    const { outgoing, incoming } = equalPowerPair();
    for (let index = 0; index < CURVE_POINTS; index += 1) {
      const power = (outgoing[index] as number) ** 2 + (incoming[index] as number) ** 2;
      expect(power).toBeCloseTo(1, 6);
    }
  });

  it("starts fully on the outgoing pad and ends fully on the incoming one", () => {
    const { outgoing, incoming } = equalPowerPair();
    expect(outgoing[0]).toBeCloseTo(1, 6);
    expect(incoming[0]).toBeCloseTo(0, 6);
    expect(outgoing[CURVE_POINTS - 1]).toBeCloseTo(0, 6);
    expect(incoming[CURVE_POINTS - 1]).toBeCloseTo(1, 6);
  });

  it("never dips below the level of either single pad", () => {
    // A pair of linear fades would drop to 0.5 total in the middle; equal power
    // keeps the sum of squares at 1, which is what stops the audible hole.
    const { outgoing, incoming } = equalPowerPair();
    const middle = Math.floor(CURVE_POINTS / 2);
    expect((outgoing[middle] as number) ** 2 + (incoming[middle] as number) ** 2).toBeCloseTo(1, 6);
  });
});

describe("fade curves", () => {
  it("rises monotonically from the start value to the target", () => {
    const curve = fadeCurve(0, 1);
    expect(curve[0]).toBe(0);
    expect(curve[CURVE_POINTS - 1]).toBe(1);
    for (let index = 1; index < CURVE_POINTS; index += 1) {
      expect(curve[index] as number).toBeGreaterThanOrEqual(curve[index - 1] as number);
    }
  });

  it("lands exactly on silence so a fade-out is truly silent", () => {
    const curve = fadeCurve(0.83, 0);
    expect(curve[CURVE_POINTS - 1]).toBe(0);
  });

  it("reverses from an arbitrary mid-fade level", () => {
    const curve = fadeCurve(0.37, 1, "smooth");
    expect(curve[0]).toBeCloseTo(0.37, 6);
    expect(curve[CURVE_POINTS - 1]).toBe(1);
  });

  it("has flat ends in smooth mode and a steeper start in equal-power mode", () => {
    const smooth = fadeCurve(0, 1, "smooth");
    const equalPower = fadeCurve(0, 1, "equal-power");
    expect(smooth[1] as number).toBeLessThan(equalPower[1] as number);
  });

  it("estimates the value at a point for a fade that has to be reversed", () => {
    expect(estimateCurveValue(0, 1, 0, "equal-power")).toBeCloseTo(0, 6);
    expect(estimateCurveValue(0, 1, 1, "equal-power")).toBeCloseTo(1, 6);
    expect(estimateCurveValue(0, 1, 0.5, "smooth")).toBeCloseTo(0.5, 6);
  });
});

describe("volume mapping", () => {
  it("maps the top of the fader to unity and the bottom to silence", () => {
    expect(volumePercentToGain(100)).toBeCloseTo(1, 6);
    expect(volumePercentToGain(0)).toBe(0);
  });

  it("is monotonic and round-trips through the percent conversion", () => {
    let previous = -1;
    for (let percent = 1; percent <= 100; percent += 1) {
      const gain = volumePercentToGain(percent);
      expect(gain).toBeGreaterThan(previous);
      previous = gain;
      expect(gainToVolumePercent(gain)).toBe(percent);
    }
  });

  it("puts the recommended 70% start well below full level", () => {
    const gain = volumePercentToGain(70);
    const decibels = 20 * Math.log10(gain);
    expect(decibels).toBeLessThan(-12);
    expect(gain).toBeLessThan(1);
  });
});

describe("pad motion labels", () => {
  it("names the documented motion ranges", () => {
    expect(PadEngine.motionLabel(0)).toBe("Still");
    expect(PadEngine.motionLabel(1)).toBe("Slow");
    expect(PadEngine.motionLabel(35)).toBe("Slow");
    expect(PadEngine.motionLabel(36)).toBe("Flowing");
    expect(PadEngine.motionLabel(70)).toBe("Flowing");
    expect(PadEngine.motionLabel(71)).toBe("Fast");
    expect(PadEngine.motionLabel(100)).toBe("Fast");
  });

  it("maps slow, flowing and fast to clearly different cycle speeds", () => {
    expect(motionFrequencyForPercent(0)).toBeCloseTo(PAD_LIMITS.motionHz.min, 6);
    expect(motionFrequencyForPercent(100)).toBeCloseTo(PAD_LIMITS.motionHz.max, 6);
    expect(motionFrequencyForPercent(25)).toBeLessThan(motionFrequencyForPercent(50));
    expect(motionFrequencyForPercent(50)).toBeLessThan(motionFrequencyForPercent(75));
    expect(motionFrequencyForPercent(75) / motionFrequencyForPercent(25)).toBeGreaterThan(4);
  });

  it("syncs motion to bars so slow songs breathe more slowly", () => {
    expect(motionBarsForPercent(18)).toBe(16);
    expect(motionBarsForPercent(50)).toBe(8);
    expect(motionBarsForPercent(90)).toBe(4);
    expect(1 / tempoSyncedMotionFrequency(18, 60, 4, 4)).toBeCloseTo(64, 6);
    expect(1 / tempoSyncedMotionFrequency(18, 120, 4, 4)).toBeCloseTo(32, 6);
    expect(tempoSyncedMotionFrequency(18, 120, 4, 4)).toBeGreaterThan(
      tempoSyncedMotionFrequency(18, 60, 4, 4),
    );
  });
});

describe("ambient tone and width mappings", () => {
  it("keeps brightness musical and bounded", () => {
    expect(brightnessPercentToDb(0)).toBeCloseTo(-12, 6);
    expect(brightnessPercentToDb(42)).toBeCloseTo(0, 6);
    expect(brightnessPercentToDb(100)).toBeCloseTo(9, 6);
    expect(brightnessPercentToDb(-20)).toBeCloseTo(-12, 6);
    expect(brightnessPercentToDb(140)).toBeCloseTo(9, 6);
  });

  it("moves from mono through the untouched source to an immersive width", () => {
    expect(widthPercentToSideGain(0)).toBeCloseTo(0, 6);
    expect(widthPercentToSideGain(50)).toBeCloseTo(1, 6);
    expect(widthPercentToSideGain(100)).toBeCloseTo(1.8, 6);
  });
});

describe("tempo-aware Sound Wall assets", () => {
  it("selects ultra slow, deep slow and slow immediately from BPM", () => {
    const engine = new PadEngine();
    const asset = {
      pitchClass: 0 as const,
      note: "C",
      url: "/normal.wav",
      loopStart: 0,
      loopEnd: 24,
      gainTrim: 1,
      tempoVariants: [
        { maxBpm: 120, url: "/deep.wav", loopStart: 0, loopEnd: 24, gainTrim: 1 },
        { maxBpm: 80, url: "/ultra.wav", loopStart: 0, loopEnd: 24, gainTrim: 1 },
      ],
    };
    engine.setTempo(60);
    expect(engine.resolveAssetForTempo(asset).url).toBe("/ultra.wav");
    engine.setTempo(100);
    expect(engine.resolveAssetForTempo(asset).url).toBe("/deep.wav");
    engine.setTempo(140);
    expect(engine.resolveAssetForTempo(asset).url).toBe("/normal.wav");
  });
});
