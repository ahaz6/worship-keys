"use client";

import type { NashvilleNumber } from "@/lib/music/nashville";

/**
 * The one thing that must be readable from two metres away: the Nashville
 * number, with the concrete chord underneath it (Design-Art.md 9.3).
 */
export function NowCard({
  nashville,
  chordName,
  confidence,
  ambiguous,
  alternative,
  concertKey,
  timeSignature,
  preparedKey,
  transitionLabel,
}: {
  nashville: NashvilleNumber | null;
  chordName: string | null;
  confidence: number;
  ambiguous: boolean;
  alternative: string | null;
  concertKey: string;
  timeSignature: string;
  preparedKey: string | null;
  transitionLabel: string;
}) {
  const uncertain = nashville != null && confidence < 0.55;

  return (
    <section className="now-card" aria-label="Current musical state">
      <div className="now-primary">
        <span className="label">Nashville</span>
        <div
          className={`nashville${nashville ? (uncertain ? " is-uncertain" : "") : " is-idle"}`}
          aria-live="polite"
          aria-label={nashville ? `Nashville ${nashville.text}` : "No chord detected"}
        >
          {nashville ? (
            <>
              {nashville.degree}
              {nashville.suffix ? <sup>{nashville.suffix}</sup> : null}
              {nashville.bassDegree ? <span>/{nashville.bassDegree}</span> : null}
            </>
          ) : (
            "—"
          )}
        </div>
        <div className={`chord-name${chordName ? "" : " is-idle"}`}>
          {chordName ?? "Play a chord to see it here"}
          {ambiguous && alternative ? <span className="meta"> · or {alternative}</span> : null}
        </div>
        <div className="confidence-bar" aria-hidden="true">
          <i style={{ width: `${Math.round(confidence * 100)}%` }} />
        </div>
        <span className="meta">
          {nashville ? `Confidence ${Math.round(confidence * 100)}%` : "Listening"}
          {uncertain ? " · uncertain" : ""}
          {ambiguous ? " · ambiguous" : ""}
        </span>
      </div>

      <div className="now-secondary">
        <div className="fact">
          <span className="label">Concert key</span>
          <strong>{concertKey}</strong>
        </div>
        <div className="fact">
          <span className="label">Time signature</span>
          <strong className="mono">{timeSignature}</strong>
        </div>
        <div className={`fact${preparedKey ? " tone-prepared" : ""}`}>
          <span className="label">Prepared</span>
          <strong>{preparedKey ?? "—"}</strong>
        </div>
        <div className="fact">
          <span className="label">Transition</span>
          <strong>{transitionLabel}</strong>
        </div>
      </div>
    </section>
  );
}
