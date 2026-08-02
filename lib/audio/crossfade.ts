/**
 * Gain curve maths for fades and key crossfades (spec 8.7 / 8.8).
 *
 * Kept free of Web Audio types so the curves can be tested directly. The engine
 * hands the resulting Float32Arrays to `setValueCurveAtTime`, which means the
 * shape is scheduled on the audio clock rather than driven by React.
 */

/** Curve resolution. 256 points is smooth well past a 20 second fade. */
export const CURVE_POINTS = 256;

export type FadeCurve = "equal-power" | "smooth";

/**
 * Equal-power pair for a crossfade. Their squares sum to 1 at every point, so
 * perceived loudness stays constant instead of dipping in the middle.
 */
export function equalPowerPair(points = CURVE_POINTS): { outgoing: Float32Array; incoming: Float32Array } {
  const outgoing = new Float32Array(points);
  const incoming = new Float32Array(points);
  for (let index = 0; index < points; index += 1) {
    const progress = index / (points - 1);
    outgoing[index] = Math.cos(progress * 0.5 * Math.PI);
    incoming[index] = Math.sin(progress * 0.5 * Math.PI);
  }
  return { outgoing, incoming };
}

/**
 * A single ramp from `from` to `to`.
 *
 * `equal-power` follows a quarter-sine, which sounds even for musical fades in
 * and out. `smooth` is a raised cosine with flat ends, useful when a fade has
 * to start and stop without any perceptible corner.
 */
export function fadeCurve(from: number, to: number, curve: FadeCurve = "equal-power", points = CURVE_POINTS): Float32Array {
  const values = new Float32Array(points);
  for (let index = 0; index < points; index += 1) {
    const progress = index / (points - 1);
    const shaped =
      curve === "equal-power" ? Math.sin(progress * 0.5 * Math.PI) : 0.5 - 0.5 * Math.cos(progress * Math.PI);
    values[index] = from + (to - from) * shaped;
  }
  // Land exactly on the target: floating point drift at the last point would
  // otherwise leave a fade-out at 1e-8 instead of true silence.
  values[points - 1] = to;
  return values;
}

/** Percent slider position (0-100) to a linear gain, shaped like a fader. */
export function volumePercentToGain(percent: number): number {
  const clamped = Math.max(0, Math.min(100, percent)) / 100;
  if (clamped <= 0) return 0;
  // -60 dB at the bottom of the travel, unity at the top.
  const decibels = -60 * (1 - clamped);
  return Math.pow(10, decibels / 20);
}

export function gainToVolumePercent(gain: number): number {
  if (gain <= 0) return 0;
  const decibels = Math.max(-60, 20 * Math.log10(gain));
  return Math.round((1 + decibels / 60) * 100);
}

/**
 * Where a linear fade currently sits, used when a fade is reversed mid-flight
 * on browsers without `cancelAndHoldAtTime`.
 */
export function estimateCurveValue(from: number, to: number, progress: number, curve: FadeCurve = "equal-power"): number {
  const clamped = Math.max(0, Math.min(1, progress));
  const shaped = curve === "equal-power" ? Math.sin(clamped * 0.5 * Math.PI) : 0.5 - 0.5 * Math.cos(clamped * Math.PI);
  return from + (to - from) * shaped;
}
