"use client";

import { useState } from "react";

import { Modal } from "@/components/common/modal";
import { spellPitchClassBoth } from "@/lib/music/notation";
import { PITCH_CLASSES, type PitchClass } from "@/lib/music/pitch";
import { SUPPORTED_TIME_SIGNATURES, formatTimeSignature, type Song } from "@/lib/storage/schema";
import type { PadPreset } from "@/types/pads";

/** Create or edit one song. A new draft never replaces an existing entry. */
export function SongDialog({
  song,
  presets,
  isNew,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
}: {
  song: Song;
  presets: readonly PadPreset[];
  isNew: boolean;
  onSave: (song: Song) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Song>(song);
  const patch = (next: Partial<Song>) => setDraft((current) => ({ ...current, ...next }));

  return (
    <Modal
      title={isNew ? "Add song" : "Edit song"}
      onClose={onClose}
      wide
      footer={
        <>
          {!isNew ? (
            <>
              <button type="button" className="btn tone-danger" onClick={onDelete}>
                Delete
              </button>
              <button type="button" className="btn" onClick={onDuplicate}>
                Duplicate
              </button>
            </>
          ) : null}
          <button type="button" className="btn tone-quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn is-active"
            onClick={() => onSave({ ...draft, title: draft.title.trim() || "Untitled song" })}
          >
            {isNew ? "Add to setlist" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-2">
          <label className="label" htmlFor="song-title">
            Title
          </label>
          <input id="song-title" type="text" value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
        </div>

        <div className="field span-2">
          <label className="label" htmlFor="song-artist">
            Artist (optional)
          </label>
          <input
            id="song-artist"
            type="text"
            value={draft.artist ?? ""}
            onChange={(event) => patch({ artist: event.target.value || undefined })}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="song-key">
            Concert key
          </label>
          <select
            id="song-key"
            value={draft.concertKey}
            onChange={(event) => patch({ concertKey: Number(event.target.value) as PitchClass })}
          >
            {PITCH_CLASSES.map((pitchClass) => (
              <option key={pitchClass} value={pitchClass}>
                {spellPitchClassBoth(pitchClass)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="song-mode">
            Mode
          </label>
          <select
            id="song-mode"
            value={draft.mode}
            onChange={(event) => {
              const nextMode = event.target.value as Song["mode"];
              const selectedPreset = presets.find((preset) => preset.id === draft.padPresetId);
              const fallback = presets.find((preset) => preset.mode === "neutral");
              patch({
                mode: nextMode,
                padPresetId:
                  selectedPreset && selectedPreset.mode !== "neutral" && selectedPreset.mode !== nextMode
                    ? (fallback?.id ?? draft.padPresetId)
                    : draft.padPresetId,
              });
            }}
          >
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="song-meter">
            Time signature
          </label>
          <select
            id="song-meter"
            value={formatTimeSignature(draft.timeSignature)}
            onChange={(event) => {
              const found = SUPPORTED_TIME_SIGNATURES.find((entry) => formatTimeSignature(entry) === event.target.value);
              if (found) patch({ timeSignature: found });
            }}
          >
            {SUPPORTED_TIME_SIGNATURES.map((signature) => (
              <option key={formatTimeSignature(signature)} value={formatTimeSignature(signature)}>
                {formatTimeSignature(signature)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="song-bpm">
            BPM (optional)
          </label>
          <input
            id="song-bpm"
            type="number"
            min={20}
            max={300}
            value={draft.bpm ?? ""}
            onChange={(event) => patch({ bpm: event.target.value ? Number(event.target.value) : undefined })}
          />
        </div>

        <div className="field span-2">
          <label className="label" htmlFor="song-preset">
            Pad preset
          </label>
          <select
            id="song-preset"
            value={draft.padPresetId}
            onChange={(event) => patch({ padPresetId: event.target.value })}
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id} disabled={preset.mode !== "neutral" && preset.mode !== draft.mode}>
                {preset.name}{preset.mode === "neutral" ? " · Major + Minor" : preset.mode === "major" ? " · Major" : " · Minor"}
              </option>
            ))}
          </select>
        </div>

        <div className="field span-2">
          <label className="label" htmlFor="song-notes">
            Notes (optional)
          </label>
          <textarea
            id="song-notes"
            rows={3}
            value={draft.notes ?? ""}
            onChange={(event) => patch({ notes: event.target.value || undefined })}
          />
        </div>
      </div>
    </Modal>
  );
}
