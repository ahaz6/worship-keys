"use client";

import { BrandMark } from "@/components/brand/brand-mark";
import { Status } from "@/components/common/status";
import { KeyboardStrip } from "@/components/midi/keyboard-strip";
import type { LiveSessionSnapshot } from "@/lib/session/protocol";

/**
 * Musician monitor (spec 18.8).
 *
 * A real monitor screen, not the leader screen with its buttons greyed out.
 * The Nashville number is the largest thing on it, then the chord, then the
 * concert key. Nothing here can change the session.
 */
export function ViewerView({
  snapshot,
  stale,
  ageSeconds,
  connected,
  onRequestLeader,
}: {
  snapshot: LiveSessionSnapshot | null;
  stale: boolean;
  ageSeconds: number;
  connected: boolean;
  onRequestLeader?: () => void;
}) {
  const transcript = snapshot?.transcript ?? [];

  return (
    <div className="live-shell viewer-live-shell">
      <div className="live-top">
        <BrandMark size={38} />
        <div className="btn-row">
          <span className={`role-chip ${stale ? "tone-stale" : "tone-live"}`}>
            {connected ? (stale ? "VIEW ONLY · RECONNECTING" : "VIEW ONLY · LIVE") : "VIEW ONLY · OFFLINE"}
          </span>
          {onRequestLeader ? (
            <button type="button" className="btn" onClick={onRequestLeader}>
              Request leader access
            </button>
          ) : null}
        </div>
      </div>

      <div className="live-main">
        <span className="label">
          {snapshot?.sessionName ?? "Session"}
          {snapshot?.activeSong ? ` · ${snapshot.activeSong.title} · Song ${snapshot.activeSong.position} of ${snapshot.activeSong.total}` : ""}
        </span>
        <div className={`live-nashville${snapshot?.nashville ? "" : " is-idle"}`} aria-live="polite">
          {snapshot?.nashville ?? "—"}
        </div>
        <div className="live-chord">{snapshot?.detectedChord ?? "Listening"}</div>
        <div className="live-key">
          {snapshot ? `Key: ${snapshot.concertKey} · ${snapshot.timeSignature}` : "Waiting for the host"}
          {snapshot?.bpm ? ` · ${snapshot.bpm} bpm` : ""}
        </div>
        {snapshot?.preparedKey ? <div className="live-prepared">Prepared: {snapshot.preparedKey}</div> : null}
      </div>

      <div className="live-foot">
        {snapshot ? (
          <div className="leader-keyboard-layer viewer-keyboard-layer">
            <div className="section-title">
              <span>Keyboard layer</span>
              <span>{snapshot.midiPressed.length + snapshot.midiSustained.length} active</span>
            </div>
            <KeyboardStrip
              pressed={snapshot.midiPressed}
              sustained={snapshot.midiSustained}
              deviceName={snapshot.midiDeviceName ?? null}
            />
          </div>
        ) : null}

        <div className="transcript">
          <span className="label">Voice transcript</span>
          {transcript.length === 0 ? <p className="interim">Nothing heard yet.</p> : null}
          {transcript.map((segment) => (
            <p key={segment.id} className={segment.final ? undefined : "interim"}>
              &ldquo;{segment.text}&rdquo;
            </p>
          ))}
          {transcript.find((segment) => segment.command) ? (
            <span className="command">COMMAND · {transcript.filter((segment) => segment.command).at(-1)?.command}</span>
          ) : null}
        </div>

        <div className="status-line">
          <Status
            tone={snapshot?.hostOnline ? "ok" : "warn"}
            state={snapshot?.hostOnline ? "Host online" : "Host offline"}
          />
          <Status
            tone={stale ? "warn" : "info"}
            state={stale ? "Reconnecting" : "Updated"}
            detail={stale ? `last update ${ageSeconds}s ago` : "now"}
          />
          <Status
            tone={snapshot?.padState === "stopped" ? "idle" : "active"}
            state="Pads"
            detail={snapshot?.padState ?? "unknown"}
          />
          <Status tone="info" state="Transition" detail={snapshot?.transitionState ?? "idle"} />
        </div>
      </div>
    </div>
  );
}
