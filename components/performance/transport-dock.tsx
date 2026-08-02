"use client";

import type { PadState } from "@/lib/audio/pad-engine";
import type { TransitionState } from "@/lib/transitions/transition-machine";

/**
 * Pad transport and transition dock (spec 6.3, Design-Art.md 9.7).
 *
 * Fade in and Fade out are a matched pair with direction glyphs and words.
 * A running fade shows its own progress on the button, and that progress is
 * read from the audio engine, so the UI cannot claim a fade is finished before
 * the automation actually is.
 */
export function TransportDock({
  padState,
  progress,
  transitionState,
  preparedLabel,
  canPrepare,
  crescendoActive,
  onFadeIn,
  onFadeOut,
  onStopNow,
  onPrepare,
  onCrescendo,
  onSwitchNow,
  onCancel,
}: {
  padState: PadState;
  progress: number;
  transitionState: TransitionState;
  preparedLabel: string | null;
  canPrepare: boolean;
  crescendoActive: boolean;
  onFadeIn: () => void;
  onFadeOut: () => void;
  onStopNow: () => void;
  onPrepare: () => void;
  onCrescendo: () => void;
  onSwitchNow: () => void;
  onCancel: () => void;
}) {
  const fadingIn = padState === "fading-in";
  const fadingOut = padState === "fading-out";
  const running = padState === "playing" || fadingIn;
  const armed = transitionState === "armed" || transitionState === "crescendo";

  return (
    <section className="dock" aria-label="Pad transport and transitions">
      <div className="dock-head">
        <span className="label">Pad transport</span>
        <span className="meta">
          {padState === "stopped"
            ? "Stopped"
            : fadingIn
              ? "Fading in"
              : fadingOut
                ? "Fading out"
                : transitionState === "transitioning"
                  ? "Transitioning"
                  : "Playing"}
        </span>
      </div>

      <div className="dock-actions">
        <button
          type="button"
          className={`transport-btn${fadingIn ? " is-running" : ""}`}
          onClick={onFadeIn}
          aria-label={fadingIn ? "Fading in" : "Fade in"}
        >
          {fadingIn ? <span className="progress" style={{ width: `${Math.round(progress * 100)}%` }} /> : null}
          <span className="arrow" aria-hidden="true">
            ▲
          </span>
          {fadingIn ? "Fading in" : "Fade in"}
        </button>

        <button
          type="button"
          className={`transport-btn${fadingOut ? " is-running" : ""}`}
          onClick={onFadeOut}
          disabled={padState === "stopped"}
          aria-label={fadingOut ? "Fading out" : "Fade out"}
        >
          {fadingOut ? <span className="progress" style={{ width: `${Math.round(progress * 100)}%` }} /> : null}
          <span className="arrow" aria-hidden="true">
            ▼
          </span>
          {fadingOut ? "Fading out" : "Fade out"}
        </button>

        <button
          type="button"
          className="transport-btn tone-stop"
          onClick={onStopNow}
          disabled={padState === "stopped"}
          title="Immediate stop for emergencies"
        >
          Stop now
        </button>
      </div>

      <div className="dock-head" style={{ borderTop: "1px solid var(--wk-line)", paddingTop: 12 }}>
        <span className="label">Transition</span>
        <span className="meta">
          {transitionState === "stopped"
            ? "Idle"
            : transitionState === "armed"
              ? `Armed — ${preparedLabel ?? "target key"}`
              : transitionState === "crescendo"
                ? "Crescendo"
                : transitionState === "transitioning"
                  ? "Crossfading"
                  : "Playing"}
        </span>
      </div>

      <div className="dock-actions">
        <button type="button" className="btn" onClick={onPrepare} disabled={!canPrepare || !running}>
          Prepare
        </button>
        <button
          type="button"
          className={`btn${crescendoActive ? " is-active" : ""}`}
          onClick={onCrescendo}
          disabled={!running}
        >
          {crescendoActive ? "Crescendo running" : "Crescendo"}
        </button>
        <button type="button" className="btn" onClick={onSwitchNow} disabled={!armed}>
          Switch now
        </button>
        <button type="button" className="btn tone-quiet" onClick={onCancel} disabled={!armed && !crescendoActive}>
          Cancel
        </button>
      </div>

      {armed ? (
        <p className="hint">
          Waiting for the tonic of {preparedLabel}. Play it to switch, or use Switch now. Sustained notes from the
          current key will not trigger it.
        </p>
      ) : null}
    </section>
  );
}
