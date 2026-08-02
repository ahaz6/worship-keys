"use client";

import { Status } from "@/components/common/status";
import type { ParsedCommand } from "@/lib/voice/command-parser";
import { REMOTE_RECOGNITION_NOTICE, type TranscriptSegment } from "@/lib/voice/speech-adapter";

/**
 * Voice commands panel and transcript strip (spec 16.2).
 *
 * The microphone never starts on its own, an open microphone is always visible,
 * and a command that was not confident enough is shown as something to confirm
 * rather than quietly executed.
 */
export function VoicePanel({
  supported,
  listening,
  segments,
  interim,
  pending,
  onConfirmPending,
  onDismissPending,
  onStart,
  onStop,
  language,
  onLanguageChange,
  requireWakeWord,
  onRequireWakeWordChange,
  deviceLabel,
  error,
}: {
  supported: boolean;
  listening: boolean;
  segments: TranscriptSegment[];
  interim: string;
  pending: ParsedCommand | null;
  onConfirmPending: () => void;
  onDismissPending: () => void;
  onStart: () => void;
  onStop: () => void;
  language: string;
  onLanguageChange: (value: string) => void;
  requireWakeWord: boolean;
  onRequireWakeWordChange: (value: boolean) => void;
  deviceLabel: string | null;
  error: string | null;
}) {
  return (
    <section className="panel-card" aria-label="Voice commands">
      <div className="section-title" style={{ padding: 0 }}>
        <span>Voice commands</span>
      </div>

      {!supported ? (
        <>
          <Status tone="idle" state="Voice" detail="Not supported in this browser" />
          <p className="hint">Everything in Worship Keys stays fully usable with the mouse and keyboard.</p>
        </>
      ) : (
        <>
          <Status
            tone={listening ? "active" : "idle"}
            state={listening ? "Listening" : "Microphone off"}
            detail={listening ? (deviceLabel ?? language) : null}
          />

          <button type="button" className={`btn${listening ? " is-active" : ""}`} onClick={listening ? onStop : onStart}>
            {listening ? "Stop listening" : "Start listening"}
          </button>

          {!listening ? <p className="hint">{REMOTE_RECOGNITION_NOTICE}</p> : null}

          <div className="field">
            <div className="field-head">
              <b>
                <label htmlFor="voice-language">Language</label>
              </b>
            </div>
            <select id="voice-language" value={language} onChange={(event) => onLanguageChange(event.target.value)}>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="de-DE">German</option>
            </select>
          </div>

          <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={requireWakeWord}
              onChange={(event) => onRequireWakeWordChange(event.target.checked)}
              style={{ width: "auto" }}
            />
            Require the wake word &ldquo;Worship Keys&rdquo;
          </label>

          <div className="transcript" aria-live="polite">
            {segments.length === 0 && !interim ? <p className="interim">Nothing heard yet.</p> : null}
            {segments.map((segment) => (
              <p key={segment.id}>&ldquo;{segment.text}&rdquo;</p>
            ))}
            {interim ? <p className="interim">{interim}</p> : null}
            {pending ? (
              <>
                <span className="command">COMMAND · {pending.label}</span>
                <p className="hint">{pending.hold}</p>
                <div className="btn-row">
                  <button type="button" className="btn is-active" onClick={onConfirmPending}>
                    Run it
                  </button>
                  <button type="button" className="btn tone-quiet" onClick={onDismissPending}>
                    Ignore
                  </button>
                </div>
              </>
            ) : null}
          </div>

          {error ? <div className="callout tone-warn">{error}</div> : null}
          <p className="hint">
            Try: Prepare G · Prepare G minor · Crescendo · Switch now · Next song · Cancel transition · Stop pads
          </p>
        </>
      )}
    </section>
  );
}
