"use client";

import { spellPitchClassBoth } from "@/lib/music/notation";
import { PITCH_CLASSES, type Mode, type PitchClass, isAccidental } from "@/lib/music/pitch";

/**
 * Chromatic selector for all twelve concert keys (spec 6.3, 7).
 *
 * Clicking a key never stops a running pad by accident — that is what Fade out
 * and Stop now are for. Clicking the key that is already current re-arms
 * nothing; clicking a different key prepares or crossfades depending on mode.
 */
export function KeyRibbon({
  currentKey,
  preparedKey,
  mode,
  readyKeys,
  onSelect,
  disabled = false,
}: {
  currentKey: PitchClass | null;
  preparedKey: PitchClass | null;
  mode: Mode;
  readyKeys: ReadonlySet<PitchClass>;
  onSelect: (pitchClass: PitchClass) => void;
  disabled?: boolean;
}) {
  return (
    <div className="key-ribbon" role="group" aria-label="Concert key">
      {PITCH_CLASSES.map((pitchClass) => {
        const isCurrent = currentKey === pitchClass;
        const isPrepared = preparedKey === pitchClass;
        const ready = readyKeys.has(pitchClass);
        const state = isCurrent ? "Current" : isPrepared ? "Prepared" : ready ? "Ready" : "Loading";
        const classes = [
          "key-pad",
          isAccidental(pitchClass) ? "is-accidental" : "",
          isCurrent ? "is-current" : "",
          isPrepared ? "is-prepared" : "",
          ready ? "" : "is-loading",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={pitchClass}
            type="button"
            className={classes}
            onClick={() => onSelect(pitchClass)}
            disabled={disabled || !ready}
            aria-pressed={isCurrent}
            aria-label={`${spellPitchClassBoth(pitchClass)} ${mode}. ${state}.`}
          >
            {isCurrent || isPrepared ? <span className="badge">{isCurrent ? "Current" : "Prepared"}</span> : null}
            {spellPitchClassBoth(pitchClass)}
            <small>{ready ? (mode === "major" ? "Major" : "Minor") : "Loading"}</small>
          </button>
        );
      })}
    </div>
  );
}
