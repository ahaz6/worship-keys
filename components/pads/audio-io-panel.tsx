"use client";

import { useState } from "react";

import { Modal } from "@/components/common/modal";
import { Status } from "@/components/common/status";
import type { AudioDeviceInfo } from "@/lib/io/media-devices";
import { shortenDeviceLabel } from "@/lib/io/media-devices";
import { ADVANCED_ROUTING_NOTE, CONNECTION_HELP, SQ_ROUTING_SETUPS } from "@/lib/io/sq-routing-profile";
import type { MidiInputInfo, MidiPermissionState } from "@/lib/midi/midi-access";

/**
 * Audio I/O panel (spec 17.1).
 *
 * MIDI Input, Voice Input and Audio Output are three different things and are
 * kept visually and verbally apart. The meter shows the level Worship Keys is
 * producing — it never claims a cable is plugged in, because the browser cannot
 * know that.
 */
export function AudioIoPanel({
  midiPermission,
  midiInputs,
  selectedMidiInput,
  onRequestMidi,
  onSelectMidiInput,
  voiceDevices,
  voiceDeviceId,
  onSelectVoiceDevice,
  voiceLabel,
  voiceChannels,
  voiceUsesSelectedTrack,
  outputLabel,
  outputDevices,
  outputDeviceId,
  canChooseOutput,
  outputHelp,
  onChooseOutput,
  onSelectOutput,
  onResetOutput,
  onTestOutput,
  meter,
}: {
  midiPermission: MidiPermissionState;
  midiInputs: MidiInputInfo[];
  selectedMidiInput: MidiInputInfo | null;
  onRequestMidi: () => void;
  onSelectMidiInput: (id: string) => void;
  voiceDevices: AudioDeviceInfo[];
  voiceDeviceId: string | null;
  onSelectVoiceDevice: (id: string) => void;
  voiceLabel: string | null;
  voiceChannels: string;
  voiceUsesSelectedTrack: boolean;
  outputLabel: string;
  outputDevices: AudioDeviceInfo[];
  outputDeviceId: string;
  canChooseOutput: boolean;
  outputHelp: string | null;
  onChooseOutput: () => void;
  onSelectOutput: (device: AudioDeviceInfo | null) => void;
  onResetOutput: () => void;
  onTestOutput: () => void;
  meter: { left: number; right: number };
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <section className="panel-card" aria-label="Audio input and output">
      <div className="section-title" style={{ padding: 0 }}>
        <span>Audio I/O</span>
        <button type="button" className="btn tone-quiet" onClick={() => setHelpOpen(true)} style={{ minHeight: 24, padding: "2px 7px", fontSize: 10 }}>
          Connection help
        </button>
      </div>

      {/* MIDI input --------------------------------------------------- */}
      <div className="field">
        {midiPermission === "unsupported" ? (
          <Status tone="warn" state="MIDI Input" detail="Not supported in this browser" />
        ) : midiPermission === "granted" ? (
          <Status
            tone={selectedMidiInput ? "ok" : "warn"}
            state="MIDI Input"
            detail={selectedMidiInput ? shortenDeviceLabel(selectedMidiInput.name) : "No device selected"}
            title={selectedMidiInput?.name}
          />
        ) : midiPermission === "denied" ? (
          <Status tone="danger" state="MIDI Input" detail="Permission blocked" />
        ) : (
          <Status tone="idle" state="MIDI Input" detail="Not connected" />
        )}

        {midiPermission === "granted" && midiInputs.length > 0 ? (
          <select
            value={selectedMidiInput?.id ?? ""}
            onChange={(event) => onSelectMidiInput(event.target.value)}
            aria-label="MIDI input device"
          >
            <option value="" disabled>
              Choose a MIDI input
            </option>
            {midiInputs.map((input) => (
              <option key={input.id} value={input.id}>
                {input.name}
              </option>
            ))}
          </select>
        ) : midiPermission === "unsupported" ? (
          <p className="hint">Use a Chromium-based desktop browser to connect a MIDI keyboard.</p>
        ) : (
          <button type="button" className="btn" onClick={onRequestMidi}>
            Connect MIDI keyboard
          </button>
        )}
      </div>

      {/* Voice input -------------------------------------------------- */}
      <div className="field">
        <Status
          tone={voiceLabel ? "ok" : "idle"}
          state="Voice Input"
          detail={voiceLabel ? shortenDeviceLabel(voiceLabel) : "Not open"}
          title={voiceLabel ?? undefined}
        />
        <select
          value={voiceDeviceId ?? ""}
          onChange={(event) => onSelectVoiceDevice(event.target.value)}
          aria-label="Voice input device"
        >
          <option value="">System default input</option>
          {voiceDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
        <p className="hint">
          {voiceChannels}
          {voiceLabel && !voiceUsesSelectedTrack
            ? " · This browser transcribes the system input, not the chosen device."
            : ""}
        </p>
        {voiceDevices.length > 0 ? <p className="hint">{ADVANCED_ROUTING_NOTE}</p> : null}
      </div>

      {/* Audio output ------------------------------------------------- */}
      <div className="field">
        <Status
          tone={outputLabel === "System default" ? "info" : "ok"}
          state="Audio Output"
          detail={shortenDeviceLabel(outputLabel)}
          title={outputLabel}
        />
        <div className="meter" aria-hidden="true">
          <div className="meter-row">
            <span>L</span>
            <div className="meter-track">
              <i style={{ width: `${Math.round(meter.left * 100)}%` }} />
            </div>
          </div>
          <div className="meter-row">
            <span>R</span>
            <div className="meter-track">
              <i style={{ width: `${Math.round(meter.right * 100)}%` }} />
            </div>
          </div>
        </div>
        <p className="hint">Output level is what Worship Keys is producing. It does not confirm a cable is connected.</p>
        <select
          value={outputDeviceId}
          onChange={(event) => {
            const device = outputDevices.find((entry) => entry.deviceId === event.target.value) ?? null;
            onSelectOutput(device);
          }}
          aria-label="Audio output device"
        >
          <option value="">System default output</option>
          {outputDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
        <div className="btn-row">
          {canChooseOutput ? (
            <>
              <button type="button" className="btn" onClick={onChooseOutput}>
                Choose output
              </button>
              {outputLabel !== "System default" ? (
                <button type="button" className="btn tone-quiet" onClick={onResetOutput}>
                  Use system default
                </button>
              ) : null}
            </>
          ) : null}
          <button type="button" className="btn" onClick={onTestOutput}>
            Test output
          </button>
        </div>
        {!canChooseOutput && outputHelp ? <p className="hint">{outputHelp}</p> : null}
      </div>

      {helpOpen ? (
        <Modal title={CONNECTION_HELP.title} onClose={() => setHelpOpen(false)} wide>
          <ul className="hint" style={{ paddingLeft: 18, display: "grid", gap: 6 }}>
            {CONNECTION_HELP.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {SQ_ROUTING_SETUPS.map((setup) => (
            <div key={setup.id} style={{ marginTop: 18 }}>
              <span className="label">{setup.name}</span>
              <p className="hint" style={{ marginTop: 6 }}>
                {setup.summary}
              </p>
              <ol className="hint" style={{ paddingLeft: 18, display: "grid", gap: 5, marginTop: 8 }}>
                {setup.steps.map((step) => (
                  <li key={step.title}>
                    <strong style={{ color: "var(--wk-text-soft)" }}>{step.title}</strong> — {step.detail}
                  </li>
                ))}
              </ol>
              <ul className="hint" style={{ paddingLeft: 18, display: "grid", gap: 5, marginTop: 8 }}>
                {setup.cautions.map((caution) => (
                  <li key={caution}>{caution}</li>
                ))}
              </ul>
            </div>
          ))}
        </Modal>
      ) : null}
    </section>
  );
}
