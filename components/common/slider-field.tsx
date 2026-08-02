"use client";

/**
 * Labelled slider with a visible value and a keyboard-reachable native input
 * (Design-Art.md 9.4). Every visual parameter in the app also has one of these,
 * so nothing is reachable only by dragging an XY surface.
 */
export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  tone = "violet",
  size = "normal",
  hint,
  defaultValue,
  onReset,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  tone?: "violet" | "blue";
  size?: "normal" | "main";
  hint?: string;
  defaultValue?: number;
  onReset?: () => void;
}) {
  const id = `slider-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const atDefault = defaultValue != null && Math.abs(value - defaultValue) < step / 2;

  return (
    <div className="field">
      <div className="field-head">
        <b>
          <label htmlFor={id}>{label}</label>
        </b>
        <span className="value">
          {hint ? `${hint} · ` : ""}
          {Number.isInteger(step) ? Math.round(value) : value.toFixed(1)}
          {unit}
        </span>
      </div>
      <input
        id={id}
        className={`slider tone-${tone}${size === "main" ? " tone-main" : ""}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${value}${unit}${hint ? ` ${hint}` : ""}`}
      />
      {defaultValue != null && onReset ? (
        <button
          type="button"
          className="btn tone-quiet"
          onClick={onReset}
          disabled={atDefault}
          style={{ justifySelf: "start", minHeight: 26, padding: "3px 7px", fontSize: 10 }}
        >
          {atDefault ? `Default ${defaultValue}${unit}` : `Reset to ${defaultValue}${unit}`}
        </button>
      ) : null}
    </div>
  );
}
