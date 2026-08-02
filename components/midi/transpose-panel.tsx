"use client";

import { useState } from "react";

import { Modal } from "@/components/common/modal";
import { spellPitchClass } from "@/lib/music/notation";
import { midiToOctave, midiToPitchClass } from "@/lib/music/pitch";
import { CALIBRATION_REFERENCE_NOTE, MAX_INPUT_TRANSPOSE, MIN_INPUT_TRANSPOSE, suggestInputTranspose } from "@/lib/music/transpose";

/**
 * Input transpose and calibration (spec 11).
 *
 * If the keyboard transposes internally, the browser only ever sees the already
 * transposed notes — it cannot tell which physical key was pressed. So the
 * correction is explicit, visible, and never applied silently.
 */
function noteLabel(midiNote: number | null): string {
  if (midiNote == null) return "—";
  return `${spellPitchClass(midiToPitchClass(midiNote), { preference: "auto" })}${midiToOctave(midiNote)} (${midiNote})`;
}

export function TransposePanel({
  inputTranspose,
  onChange,
  lastRawNote,
  deviceName,
  concertKeyLabel,
}: {
  inputTranspose: number;
  onChange: (value: number) => void;
  lastRawNote: number | null;
  deviceName: string | null;
  concertKeyLabel: string;
}) {
  const [calibrating, setCalibrating] = useState(false);
  const [captured, setCaptured] = useState<number | null>(null);

  const suggestion = captured != null ? suggestInputTranspose(captured) : null;
  const adjusted = lastRawNote == null ? null : lastRawNote + inputTranspose;

  return (
    <section className="panel-card" aria-label="Input transpose">
      <div className="section-title" style={{ padding: 0 }}>
        <span>Input transpose</span>
        <span className="mono" style={{ letterSpacing: 0, textTransform: "none" }}>
          {inputTranspose > 0 ? `+${inputTranspose}` : inputTranspose}
        </span>
      </div>

      <input
        className="slider tone-blue"
        type="range"
        min={MIN_INPUT_TRANSPOSE}
        max={MAX_INPUT_TRANSPOSE}
        step={1}
        value={inputTranspose}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Input transpose in semitones"
        aria-valuetext={`${inputTranspose} semitones`}
      />

      <dl className="hint" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", margin: 0 }}>
        <dt>Incoming</dt>
        <dd className="mono" style={{ margin: 0 }}>
          {noteLabel(lastRawNote)}
        </dd>
        <dt>Adjusted</dt>
        <dd className="mono" style={{ margin: 0 }}>
          {noteLabel(adjusted)}
        </dd>
        <dt>Concert</dt>
        <dd style={{ margin: 0 }}>{concertKeyLabel}</dd>
      </dl>

      <button type="button" className="btn" onClick={() => { setCaptured(null); setCalibrating(true); }}>
        Calibrate input
      </button>
      <p className="hint">Saved per MIDI device. A transposing keyboard cannot be detected automatically.</p>

      {calibrating ? (
        <Modal
          title="Calibrate input"
          onClose={() => setCalibrating(false)}
          footer={
            <>
              <button type="button" className="btn tone-quiet" onClick={() => setCalibrating(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn is-active"
                disabled={suggestion == null || !suggestion.withinRange}
                onClick={() => {
                  if (suggestion) onChange(suggestion.suggestedTranspose);
                  setCalibrating(false);
                }}
              >
                Apply {suggestion ? `${suggestion.suggestedTranspose > 0 ? "+" : ""}${suggestion.suggestedTranspose}` : ""}
              </button>
            </>
          }
        >
          <p className="hint">Play middle C on {deviceName ?? "your keyboard"}, then confirm the suggestion below.</p>
          <div className="form-grid">
            <div className="field">
              <span className="label">Received</span>
              <strong className="mono">{noteLabel(captured ?? lastRawNote)}</strong>
            </div>
            <div className="field">
              <span className="label">Expected</span>
              <strong className="mono">{noteLabel(CALIBRATION_REFERENCE_NOTE)}</strong>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => setCaptured(lastRawNote)} disabled={lastRawNote == null}>
              Use the last note I played
            </button>
          </div>
          {suggestion && !suggestion.withinRange ? (
            <div className="callout tone-warn" style={{ marginTop: 14 }}>
              That offset is larger than ±12 semitones. Check the octave you played before applying it.
            </div>
          ) : null}
        </Modal>
      ) : null}
    </section>
  );
}
