/**
 * Status readout: dot + short state + optional detail (Design-Art.md 9.5).
 * Colour is never the only signal — the state word always says it too.
 */

export type StatusTone = "idle" | "ok" | "active" | "info" | "warn" | "danger";

export function Status({
  tone = "idle",
  state,
  detail,
  title,
}: {
  tone?: StatusTone;
  state: string;
  detail?: string | null;
  title?: string;
}) {
  return (
    <span className={`status tone-${tone}`} title={title ?? detail ?? state}>
      <span className="dot" aria-hidden="true" />
      <strong>{state}</strong>
      {detail ? <span>— {detail}</span> : null}
    </span>
  );
}
