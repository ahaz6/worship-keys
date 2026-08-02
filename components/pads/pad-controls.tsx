"use client";

import { SliderField } from "@/components/common/slider-field";
import { XyPad } from "@/components/pads/xy-pad";
import { PAD_LIMITS, PadEngine, type PadState } from "@/lib/audio/pad-engine";
import type { PadPreset } from "@/types/pads";

export type PadSettings = {
  mainVolume: number;
  shimmer: number;
  tone: number;
  motion: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  crossfadeSeconds: number;
  crescendoSeconds: number;
};

export const PAD_DEFAULTS: PadSettings = {
  // 70% is roughly -6 dB: loud enough to hear, quiet enough to plug in safely.
  mainVolume: 70,
  shimmer: 25,
  tone: 55,
  motion: 30,
  fadeInSeconds: PAD_LIMITS.fadeSeconds.default,
  fadeOutSeconds: PAD_LIMITS.fadeSeconds.default,
  crossfadeSeconds: PAD_LIMITS.crossfadeSeconds.default,
  crescendoSeconds: PAD_LIMITS.crescendoSeconds.default,
};

/**
 * Right-rail pad controls (Design-Art.md 9.8).
 *
 * Main Volume is visually the most important level. Shimmer only governs the
 * effect send, and Motion only governs how fast the drone breathes — neither
 * changes pitch or key, and the labels say so.
 */
export function PadControls({
  padState,
  presets,
  presetId,
  onPresetChange,
  settings,
  onChange,
  muted,
  onToggleMute,
  shimmerMode,
  onImportPads,
}: {
  padState: PadState;
  presets: readonly PadPreset[];
  presetId: string;
  onPresetChange: (id: string) => void;
  settings: PadSettings;
  onChange: (patch: Partial<PadSettings>) => void;
  muted: boolean;
  onToggleMute: () => void;
  shimmerMode: "worklet" | "reverb-only";
  onImportPads: () => void;
}) {
  const preset = presets.find((entry) => entry.id === presetId);
  const stateLabel =
    padState === "stopped"
      ? "Stopped"
      : padState === "fading-in"
        ? "Fading in"
        : padState === "fading-out"
          ? "Fading out"
          : "Playing";

  return (
    <section className="panel-card" aria-label="Pad sound">
      <div className="section-title" style={{ padding: 0 }}>
        <span>Pad sound</span>
        <span className="mono" style={{ letterSpacing: 0, textTransform: "none" }}>
          {stateLabel}
        </span>
      </div>

      <div className="field">
        <div className="field-head">
          <b>
            <label htmlFor="pad-preset">Preset</label>
          </b>
        </div>
        <select id="pad-preset" value={presetId} onChange={(event) => onPresetChange(event.target.value)}>
          {presets.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        {preset ? <p className="hint">{preset.description}</p> : null}
        <button type="button" className="btn tone-quiet" onClick={onImportPads}>
          Import your own pads
        </button>
      </div>

      <SliderField
        label="Main Volume"
        value={settings.mainVolume}
        onChange={(value) => onChange({ mainVolume: value })}
        size="main"
        defaultValue={PAD_DEFAULTS.mainVolume}
        onReset={() => onChange({ mainVolume: PAD_DEFAULTS.mainVolume })}
      />
      <button type="button" className={`btn${muted ? " is-active" : ""}`} onClick={onToggleMute}>
        {muted ? "Unmute output" : "Mute output"}
      </button>

      <SliderField
        label="Shimmer"
        value={settings.shimmer}
        onChange={(value) => onChange({ shimmer: value })}
        hint={settings.shimmer === 0 ? "Dry" : undefined}
        defaultValue={PAD_DEFAULTS.shimmer}
        onReset={() => onChange({ shimmer: PAD_DEFAULTS.shimmer })}
      />
      <SliderField
        label="Tone"
        value={settings.tone}
        onChange={(value) => onChange({ tone: value })}
        tone="blue"
        hint={settings.tone < 34 ? "Dark" : settings.tone > 72 ? "Open" : "Warm"}
        defaultValue={PAD_DEFAULTS.tone}
        onReset={() => onChange({ tone: PAD_DEFAULTS.tone })}
      />
      <SliderField
        label="Pad Motion"
        value={settings.motion}
        onChange={(value) => onChange({ motion: value })}
        tone="blue"
        hint={PadEngine.motionLabel(settings.motion)}
        defaultValue={PAD_DEFAULTS.motion}
        onReset={() => onChange({ motion: PAD_DEFAULTS.motion })}
      />

      <XyPad
        tone={settings.tone}
        shimmer={settings.shimmer}
        onChange={(next) => onChange(next)}
        defaults={{ tone: PAD_DEFAULTS.tone, shimmer: PAD_DEFAULTS.shimmer }}
      />

      <p className="hint">
        Pad Motion changes how the drone moves. It never changes pitch, key or loop length.
        {shimmerMode === "reverb-only"
          ? " Shimmer is running as a filtered reverb send on this browser; the octave layer needs AudioWorklet."
          : ""}
      </p>

      <div className="inline-fields">
        <SliderField
          label="Fade in"
          value={settings.fadeInSeconds}
          onChange={(value) => onChange({ fadeInSeconds: value })}
          min={PAD_LIMITS.fadeSeconds.min}
          max={PAD_LIMITS.fadeSeconds.max}
          step={0.5}
          unit="s"
        />
        <SliderField
          label="Fade out"
          value={settings.fadeOutSeconds}
          onChange={(value) => onChange({ fadeOutSeconds: value })}
          min={PAD_LIMITS.fadeSeconds.min}
          max={PAD_LIMITS.fadeSeconds.max}
          step={0.5}
          unit="s"
        />
      </div>
      <div className="inline-fields">
        <SliderField
          label="Crossfade"
          value={settings.crossfadeSeconds}
          onChange={(value) => onChange({ crossfadeSeconds: value })}
          min={PAD_LIMITS.crossfadeSeconds.min}
          max={PAD_LIMITS.crossfadeSeconds.max}
          step={0.5}
          unit="s"
          tone="blue"
        />
        <SliderField
          label="Crescendo"
          value={settings.crescendoSeconds}
          onChange={(value) => onChange({ crescendoSeconds: value })}
          min={PAD_LIMITS.crescendoSeconds.min}
          max={PAD_LIMITS.crescendoSeconds.max}
          step={1}
          unit="s"
          tone="blue"
        />
      </div>
    </section>
  );
}
