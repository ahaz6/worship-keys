/**
 * The Worship Keys pad engine (spec section 8).
 *
 * Signal flow:
 *
 *   source A ─ keyGain A ─┐
 *                         ├─ toneFilter ─ padPanner ─ padBus ─┬─ dryGain ───────────────────┐
 *   source B ─ keyGain B ─┘                                    └─ shimmerSend ─ shimmer ─────┤
 *                                                                                            │
 *   motion LFO ─ depth ─▶ toneFilter.detune / padPanner.pan / shimmerSend.gain               │
 *                                                                                            ▼
 *                                       fadeGain ─ volumeGain ─ crescendoGain ─ limiter ─ analyser ─ destination
 *
 * Two separate gain stages carry fades and volume on purpose. `Fade in` and
 * `Fade out` automate `fadeGain` towards the *stored* main volume without ever
 * rewriting it, and a key crossfade automates the two `keyGain` nodes, so the
 * three kinds of automation never fight over the same AudioParam.
 *
 * All timing is scheduled against `AudioContext.currentTime`. React only
 * observes state; it never drives audio.
 */

import type { PitchClass } from "@/lib/music/pitch";
import type { PadKeyAsset, PadPreset } from "@/types/pads";

import { PadAssetLoader } from "./asset-loader";
import { CURVE_POINTS, type FadeCurve, equalPowerPair, fadeCurve, volumePercentToGain } from "./crossfade";

export type PadState = "stopped" | "fading-in" | "playing" | "fading-out";

export type PadEngineSnapshot = {
  state: PadState;
  currentKey: PitchClass | null;
  targetKey: PitchClass | null;
  presetId: string | null;
  /** 0-1 progress of a running fade or crossfade. */
  progress: number;
  crossfading: boolean;
  crescendoActive: boolean;
  contextState: AudioContextState | "uninitialised";
  sinkLabel: string;
  shimmerMode: "worklet" | "reverb-only";
};

export type PadEnvelopeOptions = {
  durationSeconds: number;
  /** Linear gain to fade towards. Defaults to the stored main volume. */
  targetGain?: number;
  curve?: FadeCurve;
};

export type PadEngineOptions = {
  onSnapshot?: (snapshot: PadEngineSnapshot) => void;
  onError?: (error: { code: string; message: string }) => void;
};

/** Slider ranges, all clamped inside the engine so the UI cannot exceed them. */
export const PAD_LIMITS = {
  fadeSeconds: { min: 0.5, max: 20, default: 4 },
  crossfadeSeconds: { min: 1, max: 12, default: 4 },
  crescendoSeconds: { min: 1, max: 20, default: 6 },
  /** Crescendo lifts a few dB at most — never enough to pump the limiter. */
  crescendoMaxGainDb: 5,
  shimmerFeedbackMax: 0.34,
  motionHz: { min: 0.02, max: 0.8 },
} as const;

const VOLUME_RAMP_SECONDS = 0.035;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Procedural reverb impulse: exponentially decaying stereo noise. */
function createImpulse(context: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const progress = index / length;
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - progress, decay);
    }
  }
  return impulse;
}

type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pitchClass: PitchClass;
};

export class PadEngine {
  private context: AudioContext | null = null;
  private loader: PadAssetLoader | null = null;

  // Graph nodes, created once the context exists.
  private toneFilter: BiquadFilterNode | null = null;
  private padPanner: StereoPannerNode | null = null;
  private padBus: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private shimmerSend: GainNode | null = null;
  private shimmerReturn: GainNode | null = null;
  private shimmerFeedback: GainNode | null = null;
  private shimmerWorklet: AudioWorkletNode | null = null;
  private fadeGain: GainNode | null = null;
  private volumeGain: GainNode | null = null;
  private crescendoGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyserLeft: AnalyserNode | null = null;
  private analyserRight: AnalyserNode | null = null;
  private motionLfo: OscillatorNode | null = null;
  private motionToneDepth: GainNode | null = null;
  private motionPanDepth: GainNode | null = null;
  private motionShimmerDepth: GainNode | null = null;

  private currentVoice: Voice | null = null;
  private incomingVoice: Voice | null = null;

  private preset: PadPreset | null = null;
  private state: PadState = "stopped";
  private crossfading = false;
  private crescendoActive = false;

  // Stored parameters. These are the source of truth; automation targets them.
  private mainVolumePercent = 70;
  private shimmerPercent = 25;
  private tonePercent = 55;
  private motionPercent = 30;
  private sinkLabel = "System default";
  private shimmerMode: "worklet" | "reverb-only" = "reverb-only";

  // Timeline bookkeeping for progress reporting and mid-fade reversal.
  private automationStart = 0;
  private automationEnd = 0;

  private readonly meterBufferLeft = new Float32Array(1024);
  private readonly meterBufferRight = new Float32Array(1024);

  constructor(private readonly options: PadEngineOptions = {}) {}

  /* ------------------------------------------------------------- lifecycle */

  get isInitialised(): boolean {
    return this.context != null;
  }

  get audioContext(): AudioContext | null {
    return this.context;
  }

  get assetLoader(): PadAssetLoader | null {
    return this.loader;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async initialise(): Promise<AudioContext> {
    if (this.context) {
      if (this.context.state === "suspended") await this.context.resume();
      this.emit();
      return this.context;
    }

    const context = new AudioContext({ latencyHint: "playback" });
    this.context = context;
    this.loader = new PadAssetLoader(context);
    this.buildGraph(context);
    await this.attachShimmerWorklet(context);
    if (context.state === "suspended") await context.resume();
    this.emit();
    return context;
  }

  private buildGraph(context: AudioContext): void {
    this.toneFilter = context.createBiquadFilter();
    this.toneFilter.type = "lowpass";
    this.toneFilter.Q.value = 0.6;

    this.padPanner = context.createStereoPanner();
    this.padBus = context.createGain();
    this.dryGain = context.createGain();
    this.shimmerSend = context.createGain();
    this.shimmerReturn = context.createGain();
    this.shimmerFeedback = context.createGain();
    this.fadeGain = context.createGain();
    this.volumeGain = context.createGain();
    this.crescendoGain = context.createGain();
    this.limiter = context.createDynamicsCompressor();

    // A safety limiter, not a sound-design compressor: high ratio, fast attack,
    // threshold just below clipping.
    this.limiter.threshold.value = -2;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;

    this.fadeGain.gain.value = 0;
    this.volumeGain.gain.value = volumePercentToGain(this.mainVolumePercent);
    this.crescendoGain.gain.value = 1;
    this.dryGain.gain.value = 1;

    this.toneFilter.connect(this.padPanner);
    this.padPanner.connect(this.padBus);
    this.padBus.connect(this.dryGain);
    this.padBus.connect(this.shimmerSend);
    this.dryGain.connect(this.fadeGain);
    this.shimmerReturn.connect(this.fadeGain);
    this.fadeGain.connect(this.volumeGain);
    this.volumeGain.connect(this.crescendoGain);
    this.crescendoGain.connect(this.limiter);
    this.limiter.connect(context.destination);

    // Stereo metering taps the post-limiter signal.
    const splitter = context.createChannelSplitter(2);
    this.limiter.connect(splitter);
    this.analyserLeft = context.createAnalyser();
    this.analyserRight = context.createAnalyser();
    this.analyserLeft.fftSize = 2048;
    this.analyserRight.fftSize = 2048;
    splitter.connect(this.analyserLeft, 0);
    splitter.connect(this.analyserRight, 1);

    this.buildShimmerReverb(context);
    this.buildMotion(context);
    this.applyTone();
    this.applyShimmer();
    this.applyMotion();
  }

  /** Long reverb tail plus a highpass, the part of shimmer that always works. */
  private buildShimmerReverb(context: AudioContext): void {
    if (!this.shimmerSend || !this.shimmerReturn || !this.shimmerFeedback) return;

    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 620;

    const convolver = context.createConvolver();
    convolver.buffer = createImpulse(context, 4.2, 2.6);

    const damping = context.createBiquadFilter();
    damping.type = "lowpass";
    damping.frequency.value = 7200;

    this.shimmerSend.connect(highpass);
    highpass.connect(convolver);
    convolver.connect(damping);
    damping.connect(this.shimmerReturn);

    // Bounded regeneration. The cap is enforced here, not by the slider.
    this.shimmerFeedback.gain.value = 0.22;
    this.shimmerReturn.connect(this.shimmerFeedback);
    this.shimmerFeedback.connect(highpass);

    // The return has its own headroom so shimmer can never dominate the mix.
    this.shimmerReturn.gain.value = 0.7;
  }

  /**
   * Adds the granular octave-up layer in front of the reverb when
   * AudioWorklet is available. Without it the send is still a real effect —
   * just a filtered reverb rather than a pitched shimmer — and the UI says so.
   */
  private async attachShimmerWorklet(context: AudioContext): Promise<void> {
    if (!context.audioWorklet || !this.shimmerSend || !this.shimmerReturn) return;
    try {
      await context.audioWorklet.addModule("/worklets/shimmer-processor.js");
      const worklet = new AudioWorkletNode(context, "shimmer-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      const lift = context.createBiquadFilter();
      lift.type = "highpass";
      lift.frequency.value = 900;
      const octaveGain = context.createGain();
      octaveGain.gain.value = 0.55;

      this.shimmerSend.connect(worklet);
      worklet.connect(lift);
      lift.connect(octaveGain);
      octaveGain.connect(this.shimmerReturn);
      this.shimmerWorklet = worklet;
      this.shimmerMode = "worklet";
    } catch {
      // Non-fatal: the reverb-only send remains connected.
      this.shimmerMode = "reverb-only";
    }
  }

  private buildMotion(context: AudioContext): void {
    if (!this.toneFilter || !this.padPanner || !this.shimmerSend) return;
    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = PAD_LIMITS.motionHz.min;

    this.motionToneDepth = context.createGain();
    this.motionPanDepth = context.createGain();
    this.motionShimmerDepth = context.createGain();
    this.motionToneDepth.gain.value = 0;
    this.motionPanDepth.gain.value = 0;
    this.motionShimmerDepth.gain.value = 0;

    lfo.connect(this.motionToneDepth);
    lfo.connect(this.motionPanDepth);
    lfo.connect(this.motionShimmerDepth);
    this.motionToneDepth.connect(this.toneFilter.detune);
    this.motionPanDepth.connect(this.padPanner.pan);
    this.motionShimmerDepth.connect(this.shimmerSend.gain);
    lfo.start();
    this.motionLfo = lfo;
  }

  async dispose(): Promise<void> {
    this.stopNow();
    try {
      this.motionLfo?.stop();
    } catch {
      // Already stopped.
    }
    this.motionLfo?.disconnect();
    this.shimmerWorklet?.disconnect();
    await this.context?.close();
    this.context = null;
    this.loader = null;
  }

  /* ------------------------------------------------------------------ pads */

  setPreset(preset: PadPreset): void {
    this.preset = preset;
    this.emit();
  }

  get activePreset(): PadPreset | null {
    return this.preset;
  }

  private assetFor(pitchClass: PitchClass): PadKeyAsset | null {
    return this.preset?.keys.find((key) => key.pitchClass === pitchClass) ?? null;
  }

  isKeyReady(pitchClass: PitchClass): boolean {
    if (!this.preset || !this.loader) return false;
    return this.loader.has(this.preset.id, pitchClass);
  }

  private createVoice(pitchClass: PitchClass, buffer: AudioBuffer, asset: PadKeyAsset, initialGain: number): Voice {
    const context = this.context;
    if (!context || !this.toneFilter) throw new Error("Audio engine is not initialised");

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = asset.loopStart;
    source.loopEnd = Math.min(asset.loopEnd, buffer.duration);
    // Pad Motion must never touch this. Playback rate stays at 1.0 so the pad's
    // pitch and loop length are exactly what was rendered.
    source.playbackRate.value = 1;

    const gain = context.createGain();
    gain.gain.value = initialGain * asset.gainTrim;
    source.connect(gain);
    gain.connect(this.toneFilter);
    source.start();

    return { source, gain, pitchClass };
  }

  private disposeVoice(voice: Voice, at: number): void {
    try {
      voice.source.stop(at);
    } catch {
      // Already stopped.
    }
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.gain.disconnect();
    };
  }

  /* ------------------------------------------------------- transport (8.8) */

  /**
   * Starts `pitchClass` from silence and fades up to the stored main volume.
   * Calling this during a fade-out reverses the fade from its current level
   * rather than starting a second copy of the pad.
   */
  async fadeIn(pitchClass: PitchClass, options: PadEnvelopeOptions = { durationSeconds: PAD_LIMITS.fadeSeconds.default }): Promise<void> {
    const context = await this.initialise();
    const asset = this.assetFor(pitchClass);
    if (!asset || !this.preset || !this.loader || !this.fadeGain) {
      this.options.onError?.({ code: "no-asset", message: "This key is not available in the current pad pack." });
      return;
    }

    let buffer: AudioBuffer;
    try {
      buffer = await this.loader.load(this.preset.id, asset);
    } catch (error) {
      this.options.onError?.({
        code: "decode-failed",
        message: error instanceof Error ? error.message : "The pad audio could not be decoded.",
      });
      return;
    }

    const duration = clamp(options.durationSeconds, PAD_LIMITS.fadeSeconds.min, PAD_LIMITS.fadeSeconds.max);
    const now = context.currentTime;

    if (this.currentVoice && this.currentVoice.pitchClass !== pitchClass) {
      // A different key is already running: this is a crossfade, not a fade-in.
      await this.crossfadeTo(pitchClass, duration);
      return;
    }

    if (!this.currentVoice) {
      this.currentVoice = this.createVoice(pitchClass, buffer, asset, 1);
    }

    const from = this.captureFadeGain(now);
    const to = options.targetGain ?? 1;
    this.scheduleFade(from, to, now, duration, options.curve ?? "equal-power");
    this.setState("fading-in");
    this.afterAutomation(duration, () => this.setState("playing"));
  }

  /** Fades from the current level to silence, then releases the source node. */
  fadeOut(options: PadEnvelopeOptions = { durationSeconds: PAD_LIMITS.fadeSeconds.default }): void {
    const context = this.context;
    if (!context || !this.fadeGain || !this.currentVoice) return;

    const duration = clamp(options.durationSeconds, PAD_LIMITS.fadeSeconds.min, PAD_LIMITS.fadeSeconds.max);
    const now = context.currentTime;
    const from = this.captureFadeGain(now);
    this.scheduleFade(from, 0, now, duration, options.curve ?? "equal-power");
    this.setState("fading-out");

    const voice = this.currentVoice;
    const incoming = this.incomingVoice;
    this.afterAutomation(duration, () => {
      // Only tear down if nothing reversed the fade in the meantime.
      if (this.state !== "fading-out") return;
      this.disposeVoice(voice, context.currentTime);
      if (incoming) this.disposeVoice(incoming, context.currentTime);
      this.currentVoice = null;
      this.incomingVoice = null;
      this.crossfading = false;
      this.setState("stopped");
    });
  }

  /** Immediate stop for emergencies, with a 25 ms ramp so it cannot click. */
  stopNow(): void {
    const context = this.context;
    if (!context || !this.fadeGain) return;
    const now = context.currentTime;
    const gain = this.fadeGain.gain;
    this.cancelAutomation(gain, now);
    gain.linearRampToValueAtTime(0, now + 0.025);

    const stopAt = now + 0.03;
    if (this.currentVoice) this.disposeVoice(this.currentVoice, stopAt);
    if (this.incomingVoice) this.disposeVoice(this.incomingVoice, stopAt);
    this.currentVoice = null;
    this.incomingVoice = null;
    this.crossfading = false;
    this.crescendoActive = false;
    this.automationStart = 0;
    this.automationEnd = 0;
    this.setState("stopped");
  }

  /* -------------------------------------------------------- crossfade (8.7) */

  /**
   * Equal-power crossfade into another key. The outgoing source is only
   * stopped after the automation has actually finished.
   */
  async crossfadeTo(pitchClass: PitchClass, seconds: number = PAD_LIMITS.crossfadeSeconds.default): Promise<void> {
    const context = await this.initialise();
    const asset = this.assetFor(pitchClass);
    if (!asset || !this.preset || !this.loader) return;

    if (!this.currentVoice) {
      await this.fadeIn(pitchClass, { durationSeconds: PAD_LIMITS.fadeSeconds.default });
      return;
    }
    if (this.currentVoice.pitchClass === pitchClass && !this.incomingVoice) return;

    let buffer: AudioBuffer;
    try {
      buffer = await this.loader.load(this.preset.id, asset);
    } catch (error) {
      this.options.onError?.({
        code: "target-not-ready",
        message: error instanceof Error ? error.message : "The target pad is not ready yet.",
      });
      return;
    }

    // A crossfade that arrives during another crossfade collapses the previous
    // incoming voice into the outgoing one rather than stacking three sources.
    if (this.incomingVoice) {
      this.disposeVoice(this.incomingVoice, context.currentTime + 0.05);
      this.incomingVoice = null;
    }

    const duration = clamp(seconds, PAD_LIMITS.crossfadeSeconds.min, PAD_LIMITS.crossfadeSeconds.max);
    const now = context.currentTime;
    const outgoing = this.currentVoice;
    const incoming = this.createVoice(pitchClass, buffer, asset, 0);
    this.incomingVoice = incoming;

    const { outgoing: outCurve, incoming: inCurve } = equalPowerPair(CURVE_POINTS);
    const outTrim = outgoing.gain.gain.value;
    const scaledOut = new Float32Array(CURVE_POINTS);
    const scaledIn = new Float32Array(CURVE_POINTS);
    for (let index = 0; index < CURVE_POINTS; index += 1) {
      scaledOut[index] = (outCurve[index] as number) * outTrim;
      scaledIn[index] = (inCurve[index] as number) * asset.gainTrim;
    }

    this.cancelAutomation(outgoing.gain.gain, now);
    this.cancelAutomation(incoming.gain.gain, now);
    outgoing.gain.gain.setValueCurveAtTime(scaledOut, now, duration);
    incoming.gain.gain.setValueCurveAtTime(scaledIn, now, duration);

    this.crossfading = true;
    this.automationStart = now;
    this.automationEnd = now + duration;
    this.emit();

    this.afterAutomation(duration, () => {
      if (this.incomingVoice !== incoming) return;
      this.disposeVoice(outgoing, context.currentTime);
      this.currentVoice = incoming;
      this.incomingVoice = null;
      this.crossfading = false;
      if (this.state === "stopped") this.setState("playing");
      this.emit();
    });
  }

  /* ------------------------------------------------------- crescendo (13.3) */

  startCrescendo(seconds: number = PAD_LIMITS.crescendoSeconds.default): void {
    const context = this.context;
    if (!context || !this.crescendoGain || !this.toneFilter) return;
    const duration = clamp(seconds, PAD_LIMITS.crescendoSeconds.min, PAD_LIMITS.crescendoSeconds.max);
    const now = context.currentTime;
    const peak = Math.pow(10, PAD_LIMITS.crescendoMaxGainDb / 20);

    this.cancelAutomation(this.crescendoGain.gain, now);
    this.crescendoGain.gain.setValueCurveAtTime(fadeCurve(this.crescendoGain.gain.value, peak, "smooth"), now, duration);

    // Opening the filter alongside the level is what makes it read as a build
    // rather than as somebody turning up the volume.
    const openTo = Math.min(16000, this.toneFrequency() * 2.2);
    this.cancelAutomation(this.toneFilter.frequency, now);
    this.toneFilter.frequency.setValueCurveAtTime(fadeCurve(this.toneFilter.frequency.value, openTo, "smooth"), now, duration);

    this.crescendoActive = true;
    this.automationStart = now;
    this.automationEnd = now + duration;
    this.emit();
  }

  cancelCrescendo(seconds = 1.5): void {
    const context = this.context;
    if (!context || !this.crescendoGain || !this.toneFilter) return;
    const now = context.currentTime;
    this.cancelAutomation(this.crescendoGain.gain, now);
    this.crescendoGain.gain.setValueCurveAtTime(fadeCurve(this.crescendoGain.gain.value, 1, "smooth"), now, seconds);
    this.cancelAutomation(this.toneFilter.frequency, now);
    this.toneFilter.frequency.setValueCurveAtTime(
      fadeCurve(this.toneFilter.frequency.value, this.toneFrequency(), "smooth"),
      now,
      seconds,
    );
    this.crescendoActive = false;
    this.emit();
  }

  /* ---------------------------------------------------------- sound controls */

  get mainVolume(): number {
    return this.mainVolumePercent;
  }

  setMainVolume(percent: number): void {
    this.mainVolumePercent = clamp(Math.round(percent), 0, 100);
    const context = this.context;
    if (!context || !this.volumeGain) return;
    const now = context.currentTime;
    const target = volumePercentToGain(this.mainVolumePercent);
    // A short ramp instead of a step: a stepped gain change clicks audibly.
    this.volumeGain.gain.cancelScheduledValues(now);
    this.volumeGain.gain.setValueAtTime(this.volumeGain.gain.value, now);
    this.volumeGain.gain.linearRampToValueAtTime(target, now + VOLUME_RAMP_SECONDS);
  }

  get shimmerLevel(): number {
    return this.shimmerPercent;
  }

  setShimmerLevel(percent: number): void {
    this.shimmerPercent = clamp(Math.round(percent), 0, 100);
    this.applyShimmer();
  }

  private applyShimmer(): void {
    const context = this.context;
    if (!context || !this.shimmerSend || !this.shimmerFeedback) return;
    const now = context.currentTime;
    // 0% means fully dry through the shimmer path, not silence: the dry pad is
    // a separate branch and is never attenuated by this control.
    const send = (this.shimmerPercent / 100) * 0.85;
    this.shimmerSend.gain.cancelScheduledValues(now);
    this.shimmerSend.gain.setValueAtTime(this.shimmerSend.gain.value, now);
    this.shimmerSend.gain.linearRampToValueAtTime(send, now + 0.08);

    const feedback = Math.min(PAD_LIMITS.shimmerFeedbackMax, 0.1 + (this.shimmerPercent / 100) * 0.24);
    this.shimmerFeedback.gain.setTargetAtTime(feedback, now, 0.05);
    this.applyMotion();
  }

  get tone(): number {
    return this.tonePercent;
  }

  setTone(percent: number): void {
    this.tonePercent = clamp(Math.round(percent), 0, 100);
    this.applyTone();
  }

  /** Maps the Tone slider to a cutoff, logarithmically from dark to open. */
  private toneFrequency(): number {
    const min = 320;
    const max = 14000;
    return min * Math.pow(max / min, this.tonePercent / 100);
  }

  private applyTone(): void {
    const context = this.context;
    if (!context || !this.toneFilter) return;
    if (this.crescendoActive) return; // a running crescendo owns this param
    const now = context.currentTime;
    this.toneFilter.frequency.cancelScheduledValues(now);
    this.toneFilter.frequency.setValueAtTime(this.toneFilter.frequency.value, now);
    // Musical parameters are followed softly rather than snapped.
    this.toneFilter.frequency.setTargetAtTime(this.toneFrequency(), now, 0.06);
  }

  get motion(): number {
    return this.motionPercent;
  }

  setMotion(percent: number): void {
    this.motionPercent = clamp(Math.round(percent), 0, 100);
    this.applyMotion();
  }

  /** Human label for the Motion slider (spec 8.5). */
  static motionLabel(percent: number): "Still" | "Slow" | "Flowing" | "Fast" {
    if (percent <= 0) return "Still";
    if (percent <= 35) return "Slow";
    if (percent <= 70) return "Flowing";
    return "Fast";
  }

  private applyMotion(): void {
    const context = this.context;
    if (!context || !this.motionLfo || !this.motionToneDepth || !this.motionPanDepth || !this.motionShimmerDepth) return;
    const now = context.currentTime;
    const amount = this.motionPercent / 100;
    const hz = PAD_LIMITS.motionHz.min + amount * (PAD_LIMITS.motionHz.max - PAD_LIMITS.motionHz.min);

    this.motionLfo.frequency.setTargetAtTime(hz, now, 0.4);
    // Depths are modest by design: motion should be noticed over half a minute,
    // not read as an effect.
    this.motionToneDepth.gain.setTargetAtTime(amount * 900, now, 0.3);
    this.motionPanDepth.gain.setTargetAtTime(amount * 0.28, now, 0.3);
    this.motionShimmerDepth.gain.setTargetAtTime(amount * (this.shimmerPercent / 100) * 0.12, now, 0.3);
  }

  /* ------------------------------------------------------------ audio output */

  get outputLabel(): string {
    return this.sinkLabel;
  }

  static canChooseOutput(context: AudioContext | null): boolean {
    const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    const hasPicker = typeof (mediaDevices as { selectAudioOutput?: unknown } | undefined)?.selectAudioOutput === "function";
    const hasSink = context != null && typeof (context as { setSinkId?: unknown }).setSinkId === "function";
    return hasPicker && hasSink;
  }

  /** Routes the pad output at a chosen device. Requires a user gesture. */
  async setOutputDevice(deviceId: string, label: string): Promise<void> {
    const context = this.context;
    if (!context) return;
    const setSinkId = (context as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId;
    if (typeof setSinkId !== "function") {
      this.options.onError?.({
        code: "sink-unsupported",
        message: "This browser cannot choose an audio output. Choose the output in your system audio settings.",
      });
      return;
    }
    try {
      await setSinkId.call(context, deviceId);
      this.sinkLabel = label;
      this.emit();
    } catch (error) {
      this.options.onError?.({
        code: "sink-failed",
        message: error instanceof Error ? error.message : "The chosen output could not be used.",
      });
    }
  }

  async resetOutputToSystemDefault(): Promise<void> {
    const context = this.context;
    if (!context) return;
    const setSinkId = (context as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId;
    if (typeof setSinkId === "function") {
      try {
        await setSinkId.call(context, "");
      } catch {
        // Leaving the previous sink in place is better than throwing here.
      }
    }
    this.sinkLabel = "System default";
    this.emit();
  }

  /** Quiet test tone so cabling can be verified without unmuting the pads. */
  async playTestSignal(seconds = 1.4): Promise<void> {
    const context = await this.initialise();
    if (!this.limiter) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 220;
    // Deliberately low: a test tone must never be the loudest thing in the room.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.25);
    gain.gain.setValueAtTime(0.06, now + seconds - 0.3);
    gain.gain.linearRampToValueAtTime(0, now + seconds);
    oscillator.connect(gain);
    gain.connect(this.limiter);
    oscillator.start(now);
    oscillator.stop(now + seconds + 0.05);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  /** Peak level per channel, 0-1, for the output meter. */
  readMeter(): { left: number; right: number } {
    if (!this.analyserLeft || !this.analyserRight) return { left: 0, right: 0 };
    this.analyserLeft.getFloatTimeDomainData(this.meterBufferLeft);
    this.analyserRight.getFloatTimeDomainData(this.meterBufferRight);
    let left = 0;
    let right = 0;
    for (let index = 0; index < this.meterBufferLeft.length; index += 1) {
      left = Math.max(left, Math.abs(this.meterBufferLeft[index] as number));
      right = Math.max(right, Math.abs(this.meterBufferRight[index] as number));
    }
    return { left: Math.min(1, left), right: Math.min(1, right) };
  }

  /* ------------------------------------------------------------- internals */

  /**
   * Reads the fade gain's live value and freezes automation at that point, so
   * a reversal continues from what is actually being heard.
   */
  private captureFadeGain(now: number): number {
    const gain = this.fadeGain?.gain;
    if (!gain) return 0;
    const value = gain.value;
    this.cancelAutomation(gain, now);
    return value;
  }

  private cancelAutomation(param: AudioParam, now: number): void {
    const holdable = param as AudioParam & { cancelAndHoldAtTime?: (time: number) => AudioParam };
    if (typeof holdable.cancelAndHoldAtTime === "function") {
      holdable.cancelAndHoldAtTime(now);
      return;
    }
    // Fallback for browsers without cancelAndHoldAtTime: pin the current value
    // before clearing, so the parameter does not jump back to an older target.
    const value = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(value, now);
  }

  private scheduleFade(from: number, to: number, now: number, duration: number, curve: FadeCurve): void {
    const gain = this.fadeGain?.gain;
    if (!gain) return;
    gain.setValueAtTime(from, now);
    gain.setValueCurveAtTime(fadeCurve(from, to, curve), now, duration);
    this.automationStart = now;
    this.automationEnd = now + duration;
  }

  private afterAutomation(duration: number, run: () => void): void {
    // Scheduling is done on the audio clock; this timer only advances UI state
    // once the automation it mirrors has definitely finished.
    setTimeout(run, duration * 1000 + 40);
  }

  private setState(state: PadState): void {
    this.state = state;
    this.emit();
  }

  progress(): number {
    const context = this.context;
    if (!context || this.automationEnd <= this.automationStart) return 0;
    const span = this.automationEnd - this.automationStart;
    return clamp((context.currentTime - this.automationStart) / span, 0, 1);
  }

  snapshot(): PadEngineSnapshot {
    return {
      state: this.state,
      currentKey: this.currentVoice?.pitchClass ?? null,
      targetKey: this.incomingVoice?.pitchClass ?? null,
      presetId: this.preset?.id ?? null,
      progress: this.progress(),
      crossfading: this.crossfading,
      crescendoActive: this.crescendoActive,
      contextState: this.context?.state ?? "uninitialised",
      sinkLabel: this.sinkLabel,
      shimmerMode: this.shimmerMode,
    };
  }

  private emit(): void {
    this.options.onSnapshot?.(this.snapshot());
  }
}
