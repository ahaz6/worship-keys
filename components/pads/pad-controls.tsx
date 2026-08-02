"use client";

import { SliderField } from "@/components/common/slider-field";
import { BrightnessWidthPad, XyPad } from "@/components/pads/xy-pad";
import { PAD_LIMITS, type PadState } from "@/lib/audio/pad-engine";
import type { Mode } from "@/lib/music/pitch";
import type { PadPreset } from "@/types/pads";

export type PadSettings = {
  mainVolume: number;
  shimmer: number;
  tone: number;
  brightness: number;
  width: number;
  motion: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  crossfadeSeconds: number;
  crescendoSeconds: number;
};

export const PAD_DEFAULTS: PadSettings = {
  // 70% is roughly -6 dB: loud enough to hear, quiet enough to plug in safely.
  mainVolume: 62,
  shimmer: 100,
  tone: 100,
  brightness: 0,
  width: 0,
  motion: 18,
  fadeInSeconds: PAD_LIMITS.fadeSeconds.default,
  fadeOutSeconds: PAD_LIMITS.fadeSeconds.default,
  crossfadeSeconds: PAD_LIMITS.crossfadeSeconds.default,
  crescendoSeconds: PAD_LIMITS.crescendoSeconds.default,
};

/** The midpoint of the visible 40–180 BPM range. */
export const DEFAULT_PAD_TEMPO_BPM = 110;

/**
 * Right-rail pad controls (Design-Art.md 9.8).
 *
 * Main Volume is visually the most important level. Shimmer only governs the
 * effect send, and Motion only governs how fast the pad breathes — neither
 * changes pitch or key, and the labels say so.
 */
export function PadControls({
  padState,
  presets,
  presetId,
  mode,
  onPresetChange,
  settings,
  onChange,
  muted,
  onToggleMute,
  shimmerMode,
  bpm,
  onBpmChange,
}: {
  padState: PadState;
  presets: readonly PadPreset[];
  presetId: string;
  mode: Mode;
  onPresetChange: (id: string) => void;
  settings: PadSettings;
  onChange: (patch: Partial<PadSettings>) => void;
  muted: boolean;
  onToggleMute: () => void;
  shimmerMode: "worklet" | "reverb-only";
  bpm: number;
  onBpmChange: (bpm: number) => void;
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
            <option key={entry.id} value={entry.id} disabled={entry.mode !== "neutral" && entry.mode !== mode}>
              {entry.name}{entry.mode === "neutral" ? " · Major + Minor" : entry.mode === "major" ? " · Major" : " · Minor"}
            </option>
          ))}
        </select>
        {preset ? (
          <p className="hint">
            {preset.description} {preset.mode === "neutral" ? "Works in major and minor." : `Designed for ${preset.mode} keys.`}
          </p>
        ) : null}
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
        label="Song Tempo"
        value={bpm}
        onChange={onBpmChange}
        min={40}
        max={180}
        step={1}
        unit=" BPM"
        tone="blue"
        defaultValue={DEFAULT_PAD_TEMPO_BPM}
        onReset={() => onBpmChange(DEFAULT_PAD_TEMPO_BPM)}
        hint={bpm <= 80 ? "Deep & natural" : bpm <= 120 ? "Warm & natural" : "Light & natural"}
      />

      <XyPad
        tone={settings.tone}
        shimmer={settings.shimmer}
        onChange={(next) => onChange(next)}
        defaults={{ tone: PAD_DEFAULTS.tone, shimmer: PAD_DEFAULTS.shimmer }}
      />

      <BrightnessWidthPad
        brightness={settings.brightness}
        width={settings.width}
        onChange={(next) => onChange(next)}
        defaults={{ brightness: PAD_DEFAULTS.brightness, width: PAD_DEFAULTS.width }}
      />

      <p className="hint">
        Both sound surfaces react live; double-click restores their defaults. Pad motion stays fixed on Slow.
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
