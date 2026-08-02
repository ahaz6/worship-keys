/**
 * Granular octave-up pitch shifter for the Worship Keys shimmer send.
 *
 * Shifting the pad by changing `AudioBufferSourceNode.playbackRate` is not an
 * option: that would move the pitch and the loop length of the pad itself.
 * Instead this worklet keeps a short delay line of the incoming pad signal and
 * reads it back at twice the write rate through two overlapping, cross-faded
 * grains. The result is a real +12 semitone layer derived from whatever is
 * currently playing, while the dry pad stays untouched.
 *
 * Two grains at 180 degrees of phase, windowed with a raised cosine, keep the
 * overlap-add free of amplitude modulation artefacts.
 */

const BUFFER_SECONDS = 0.25;
const GRAIN_SECONDS = 0.08;
const PITCH_RATIO = 2; // one octave up

class ShimmerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = Math.ceil(BUFFER_SECONDS * sampleRate);
    this.grainSize = Math.floor(GRAIN_SECONDS * sampleRate);
    this.lines = [new Float32Array(this.bufferSize), new Float32Array(this.bufferSize)];
    this.writeIndex = 0;
    // Two grain read positions, offset by half a grain.
    this.grainPhase = [0, this.grainSize / 2];
    this.active = true;
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.active === "boolean") this.active = event.data.active;
    };
  }

  static get parameterDescriptors() {
    return [{ name: "mix", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" }];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const frames = output[0].length;
    const mixParam = parameters.mix;
    const mix = mixParam.length > 0 ? mixParam[0] : 1;

    for (let frame = 0; frame < frames; frame += 1) {
      // Write the incoming pad into the delay line, one line per channel.
      for (let channel = 0; channel < this.lines.length; channel += 1) {
        const source = input && input[channel] ? input[channel] : input && input[0] ? input[0] : null;
        this.lines[channel][this.writeIndex] = source ? source[frame] : 0;
      }

      for (let channel = 0; channel < output.length; channel += 1) {
        const line = this.lines[Math.min(channel, this.lines.length - 1)];
        let sum = 0;

        for (let grain = 0; grain < 2; grain += 1) {
          const phase = this.grainPhase[grain];
          // Read head runs PITCH_RATIO times faster than the write head, so it
          // trails the write position by a growing distance within the grain.
          const delay = phase * (PITCH_RATIO - 1);
          let readPosition = this.writeIndex - delay;
          while (readPosition < 0) readPosition += this.bufferSize;

          const base = Math.floor(readPosition);
          const fraction = readPosition - base;
          const a = line[base % this.bufferSize];
          const b = line[(base + 1) % this.bufferSize];
          const sample = a + (b - a) * fraction;

          // Raised-cosine window over the grain.
          const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * phase) / this.grainSize);
          sum += sample * window;
        }

        output[channel][frame] = this.active ? sum * mix : 0;
      }

      for (let grain = 0; grain < 2; grain += 1) {
        this.grainPhase[grain] += 1;
        if (this.grainPhase[grain] >= this.grainSize) this.grainPhase[grain] -= this.grainSize;
      }
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }

    return true;
  }
}

registerProcessor("shimmer-processor", ShimmerProcessor);
