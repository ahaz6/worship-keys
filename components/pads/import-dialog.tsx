"use client";

import { useCallback, useState } from "react";

import { Modal } from "@/components/common/modal";
import { spellPitchClassBoth } from "@/lib/music/notation";
import { PITCH_CLASSES, type Mode, type PitchClass } from "@/lib/music/pitch";
import type { PadPreset } from "@/types/pads";

/**
 * Local pad import (spec 8.10).
 *
 * Files stay on this machine: they are decoded in the browser and handed
 * straight to the engine, never uploaded. Each file is checked before it is
 * accepted — the app refuses something it cannot decode rather than failing
 * silently in the middle of a service.
 */

export type ImportedPad = {
  pitchClass: PitchClass;
  fileName: string;
  data: ArrayBuffer;
  durationSeconds: number;
  channels: number;
  peak: number;
  gainTrim: number;
};

type Candidate = {
  id: string;
  file: File;
  pitchClass: PitchClass;
  status: "checking" | "ready" | "rejected";
  message: string;
  durationSeconds: number;
  channels: number;
  peak: number;
  data: ArrayBuffer | null;
};

/** Guesses the key from a file name like `pad_Bb.wav` or `07-G.wav`. */
function guessPitchClass(fileName: string, fallback: PitchClass): PitchClass {
  const match = /(?:^|[^a-z])([a-gA-G])([b#]?)(?:[^a-z]|$)/.exec(fileName.replace(/\.[^.]+$/, ""));
  if (!match) return fallback;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const semitone = base[(match[1] as string).toUpperCase()];
  if (semitone === undefined) return fallback;
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return (((semitone + accidental) % 12 + 12) % 12) as PitchClass;
}

const MIN_SECONDS = 1;
const MAX_SECONDS = 120;

export function ImportDialog({
  onClose,
  onImport,
  decode,
}: {
  onClose: () => void;
  /** Receives the validated pads plus the name for the new local preset. */
  onImport: (name: string, mode: Mode | "neutral", pads: ImportedPad[]) => void;
  /** Decodes an encoded file; supplied by the engine so it uses one context. */
  decode: (data: ArrayBuffer) => Promise<AudioBuffer>;
}) {
  const [presetName, setPresetName] = useState("My pads");
  const [presetMode, setPresetMode] = useState<Mode | "neutral">("neutral");
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const incoming: Candidate[] = [...files].map((file, index) => ({
        id: `${file.name}-${index}-${Date.now()}`,
        file,
        pitchClass: guessPitchClass(file.name, (index % 12) as PitchClass),
        status: "checking",
        message: "Checking…",
        durationSeconds: 0,
        channels: 0,
        peak: 0,
        data: null,
      }));
      setCandidates((current) => [...current, ...incoming]);

      for (const candidate of incoming) {
        const raw = await candidate.file.arrayBuffer();
        let patch: Partial<Candidate>;
        try {
          // decodeAudioData detaches the buffer, so keep a copy for the engine.
          const buffer = await decode(raw.slice(0));
          let peak = 0;
          for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const data = buffer.getChannelData(channel);
            for (let index = 0; index < data.length; index += 64) {
              peak = Math.max(peak, Math.abs(data[index] as number));
            }
          }
          if (buffer.duration < MIN_SECONDS) {
            patch = { status: "rejected", message: `Too short (${buffer.duration.toFixed(1)}s). Pads need at least ${MIN_SECONDS}s.` };
          } else if (buffer.duration > MAX_SECONDS) {
            patch = { status: "rejected", message: `Too long (${Math.round(buffer.duration)}s). Keep pads under ${MAX_SECONDS}s.` };
          } else {
            patch = {
              status: "ready",
              // A near-full-scale file leaves no headroom for shimmer, so the
              // import trims it rather than letting the limiter deal with it.
              message:
                peak > 0.95
                  ? "Very close to full scale — trimmed by 3 dB to leave headroom."
                  : `${buffer.duration.toFixed(1)}s · ${buffer.numberOfChannels === 1 ? "mono" : "stereo"} · peak ${Math.round(peak * 100)}%`,
              durationSeconds: buffer.duration,
              channels: buffer.numberOfChannels,
              peak,
              data: raw,
            };
          }
        } catch {
          patch = { status: "rejected", message: "This file could not be decoded. Try WAV, FLAC or MP3." };
        }
        setCandidates((current) => current.map((entry) => (entry.id === candidate.id ? { ...entry, ...patch } : entry)));
      }
    },
    [decode],
  );

  const ready = candidates.filter((candidate) => candidate.status === "ready");
  const duplicateKeys = new Set(
    ready.map((candidate) => candidate.pitchClass).filter((pitchClass, index, all) => all.indexOf(pitchClass) !== index),
  );

  return (
    <Modal
      title="Import your own pads"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn tone-quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn is-active"
            disabled={ready.length === 0 || duplicateKeys.size > 0}
            onClick={() =>
              onImport(
                presetName.trim() || "My pads",
                presetMode,
                ready.map((candidate) => ({
                  pitchClass: candidate.pitchClass,
                  fileName: candidate.file.name,
                  data: candidate.data as ArrayBuffer,
                  durationSeconds: candidate.durationSeconds,
                  channels: candidate.channels,
                  peak: candidate.peak,
                  gainTrim: candidate.peak > 0.95 ? 0.7 : 1,
                })),
              )
            }
          >
            Add {ready.length} pad{ready.length === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <p className="hint">
        Files stay on this computer. Worship Keys decodes them locally and never uploads them. Only import audio you
        created or whose licence allows use outside its original product.
      </p>

      <div className="field" style={{ marginTop: 16 }}>
        <label className="label" htmlFor="import-name">
          Pad pack name
        </label>
        <input id="import-name" type="text" value={presetName} onChange={(event) => setPresetName(event.target.value)} />
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label className="label" htmlFor="import-mode">
          Harmonic character
        </label>
        <select id="import-mode" value={presetMode} onChange={(event) => setPresetMode(event.target.value as Mode | "neutral")}>
          <option value="neutral">Neutral · no major/minor third</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
        <p className="hint">Choose neutral only when the recording contains no third. This prevents a major pad playing under a minor song.</p>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label className="label" htmlFor="import-files">
          Audio files
        </label>
        <input
          id="import-files"
          type="file"
          accept="audio/wav,audio/x-wav,audio/flac,audio/mpeg,.wav,.flac,.mp3"
          multiple
          onChange={(event) => void addFiles(event.target.files)}
        />
      </div>

      {candidates.length > 0 ? (
        <div className="device-list" style={{ marginTop: 16 }}>
          {candidates.map((candidate) => (
            <div key={candidate.id} className="device-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {candidate.file.name}
                </strong>
                <small
                  className="hint"
                  style={{ color: candidate.status === "rejected" ? "var(--wk-danger)" : undefined }}
                >
                  {candidate.message}
                </small>
              </span>
              <select
                value={candidate.pitchClass}
                aria-label={`Key for ${candidate.file.name}`}
                disabled={candidate.status !== "ready"}
                onChange={(event) =>
                  setCandidates((current) =>
                    current.map((entry) =>
                      entry.id === candidate.id ? { ...entry, pitchClass: Number(event.target.value) as PitchClass } : entry,
                    ),
                  )
                }
                style={{ width: "auto" }}
              >
                {PITCH_CLASSES.map((pitchClass) => (
                  <option key={pitchClass} value={pitchClass}>
                    {spellPitchClassBoth(pitchClass)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn tone-quiet"
                onClick={() => setCandidates((current) => current.filter((entry) => entry.id !== candidate.id))}
                style={{ minHeight: 28, padding: "4px 8px", fontSize: 10 }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {duplicateKeys.size > 0 ? (
        <div className="callout tone-warn" style={{ marginTop: 14 }}>
          Two files are assigned to the same key. Give each key exactly one pad.
        </div>
      ) : null}

      <p className="hint" style={{ marginTop: 14 }}>
        Keys you do not import stay unavailable in this pack. Imported packs live in this browser only and are gone when
        you clear its data.
      </p>
    </Modal>
  );
}

/** Builds a preset description from imported files. */
export function buildLocalPreset(id: string, name: string, mode: Mode | "neutral", pads: ImportedPad[]): PadPreset {
  return {
    id,
    name,
    description: `Imported locally · ${pads.length} of 12 keys`,
    mode,
    local: true,
    keys: pads
      .slice()
      .sort((a, b) => a.pitchClass - b.pitchClass)
      .map((pad) => ({
        pitchClass: pad.pitchClass,
        note: spellPitchClassBoth(pad.pitchClass),
        url: `local:${id}:${pad.pitchClass}`,
        loopStart: 0,
        loopEnd: pad.durationSeconds,
        gainTrim: pad.gainTrim,
      })),
  };
}
