"use client";

import { BrandMark } from "@/components/brand/brand-mark";
import { Status } from "@/components/common/status";
import { KeyRibbon } from "@/components/performance/key-ribbon";
import { spellPitchClassBoth } from "@/lib/music/notation";
import { PITCH_CLASSES, type Mode, type PitchClass } from "@/lib/music/pitch";
import type { LeaderCommand, LiveSessionSnapshot } from "@/lib/session/protocol";

/**
 * Pianist iPad (spec 18.2).
 *
 * Musical controls only. Devices, channels, sample rates and anything that
 * could break the hardware connection stay on the host. Nothing here shows as
 * done until the host has acknowledged it.
 */
export function LeaderView({
  snapshot,
  stale,
  ageSeconds,
  pendingCommand,
  lastMessage,
  onCommand,
}: {
  snapshot: LiveSessionSnapshot | null;
  stale: boolean;
  ageSeconds: number;
  pendingCommand: boolean;
  lastMessage: string | null;
  onCommand: (command: LeaderCommand) => void;
}) {
  const locked = snapshot?.remoteControlLocked ?? false;
  const armed = snapshot?.transitionState === "armed" || snapshot?.transitionState === "crescendo";
  const playing = snapshot?.padState !== "stopped";
  // Every key is offered: the host holds the pads and knows what is decoded.
  const allKeys = new Set<PitchClass>(PITCH_CLASSES);
  const mode: Mode = snapshot?.mode ?? "major";

  return (
    <div className="live-shell">
      <div className="live-top">
        <BrandMark size={38} />
        <div className="btn-row">
          <span className={`role-chip ${stale ? "tone-stale" : "tone-live"}`}>
            {stale ? "LEADER · RECONNECTING" : "LEADER · LIVE"}
          </span>
        </div>
      </div>

      {locked ? <div className="callout tone-warn">Remote control is locked by the host.</div> : null}
      {lastMessage ? <div className="callout">{lastMessage}</div> : null}

      <div className="live-main" style={{ gap: 8 }}>
        <span className="label">
          {snapshot?.activeSong
            ? `${snapshot.activeSong.title} · Song ${snapshot.activeSong.position} of ${snapshot.activeSong.total}`
            : "No song selected"}
        </span>
        <div className={`live-nashville${snapshot?.nashville ? "" : " is-idle"}`} style={{ fontSize: "clamp(90px, 18vw, 180px)" }}>
          {snapshot?.nashville ?? "—"}
        </div>
        <div className="live-chord" style={{ fontSize: "clamp(24px, 5vw, 46px)" }}>
          {snapshot?.detectedChord ?? "Listening"}
        </div>
        <div className="live-key">
          {snapshot ? `${snapshot.concertKey} · ${snapshot.timeSignature}` : ""}
        </div>
        {snapshot?.preparedKey ? <div className="live-prepared">Prepared: {snapshot.preparedKey}</div> : null}
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <div className="section-title">
            <span>Prepare a key</span>
            <span>{mode === "major" ? "Major" : "Minor"}</span>
          </div>
          <KeyRibbon
            currentKey={null}
            preparedKey={null}
            mode={mode}
            readyKeys={allKeys}
            disabled={locked || pendingCommand}
            onSelect={(tonic) => onCommand({ type: "prepare", tonic, mode })}
          />
          <p className="hint" style={{ marginTop: 8 }}>
            Choosing a key arms it on the host. Play its tonic, or use Switch now.
            {snapshot?.preparedKey ? "" : ` Currently no key is prepared.`}
          </p>
        </div>

        <div className="dock-actions">
          <button type="button" className="transport-btn" disabled={locked || pendingCommand} onClick={() => onCommand({ type: "fade-in" })}>
            <span className="arrow" aria-hidden="true">▲</span>
            Fade in
          </button>
          <button
            type="button"
            className="transport-btn"
            disabled={locked || pendingCommand || !playing}
            onClick={() => onCommand({ type: "fade-out" })}
          >
            <span className="arrow" aria-hidden="true">▼</span>
            Fade out
          </button>
          <button type="button" className="btn" disabled={locked || pendingCommand || !playing} onClick={() => onCommand({ type: "crescendo" })}>
            Crescendo
          </button>
          <button type="button" className="btn" disabled={locked || pendingCommand || !armed} onClick={() => onCommand({ type: "switch-now" })}>
            Switch now
          </button>
          <button type="button" className="btn tone-quiet" disabled={locked || pendingCommand || !armed} onClick={() => onCommand({ type: "cancel-preparation" })}>
            Cancel
          </button>
          <button type="button" className="transport-btn tone-stop" disabled={locked || pendingCommand} onClick={() => onCommand({ type: "stop-pads" })}>
            Stop now
          </button>
        </div>

        <div className="dock-actions">
          <button type="button" className="btn" disabled={locked || pendingCommand} onClick={() => onCommand({ type: "previous-song" })}>
            ← Previous song
          </button>
          <button type="button" className="btn" disabled={locked || pendingCommand} onClick={() => onCommand({ type: "next-song" })}>
            Next song →
          </button>
          <select
            value={mode}
            disabled={locked || pendingCommand}
            onChange={(event) =>
              snapshot &&
              onCommand({
                type: "set-key",
                tonic: keyTonicFrom(snapshot.concertKey),
                mode: event.target.value as Mode,
              })
            }
            aria-label="Song mode"
            style={{ width: "auto" }}
          >
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
        </div>

        <div className="status-line">
          <Status tone={snapshot?.hostOnline ? "ok" : "warn"} state={snapshot?.hostOnline ? "Host online" : "Host offline"} />
          <Status tone={stale ? "warn" : "info"} state={stale ? "Reconnecting" : "Updated"} detail={stale ? `${ageSeconds}s ago` : "now"} />
          <Status tone={pendingCommand ? "active" : "idle"} state={pendingCommand ? "Waiting for host" : "Ready"} />
        </div>
      </div>
    </div>
  );
}

/** Reads the tonic back out of a "G Major" style label from the snapshot. */
function keyTonicFrom(label: string): PitchClass {
  const name = label.split(" ")[0] ?? "C";
  const index = PITCH_CLASSES.find((pitchClass) => spellPitchClassBoth(pitchClass).split("/").includes(name));
  return index ?? 0;
}
