"use client";

import { useCallback, useRef } from "react";

/**
 * Tone / Shimmer performance surface (spec 8.6).
 *
 * Horizontal is Tone, dark to open. Vertical is Shimmer, dry at the bottom.
 * The surface is a convenience, never the only route: the two sliders beside it
 * stay in sync and remain the accessible control. Arrow keys nudge, and a
 * double click returns to the preset default.
 */
export function XyPad({
  tone,
  shimmer,
  onChange,
  defaults,
}: {
  tone: number;
  shimmer: number;
  onChange: (next: { tone: number; shimmer: number }) => void;
  defaults: { tone: number; shimmer: number };
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = surfaceRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const x = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height));
      onChange({ tone: Math.round(x * 100), shimmer: Math.round((1 - y) * 100) });
    },
    [onChange],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    applyFromPointer(event.clientX, event.clientY);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.buttons === 0) return;
    applyFromPointer(event.clientX, event.clientY);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, { tone: number; shimmer: number }> = {
      ArrowLeft: { tone: -step, shimmer: 0 },
      ArrowRight: { tone: step, shimmer: 0 },
      ArrowUp: { tone: 0, shimmer: step },
      ArrowDown: { tone: 0, shimmer: -step },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onChange({
      tone: Math.max(0, Math.min(100, tone + move.tone)),
      shimmer: Math.max(0, Math.min(100, shimmer + move.shimmer)),
    });
  };

  return (
    <div className="field">
      <div className="field-head">
        <b>Tone &amp; Shimmer</b>
        <span className="value">
          {tone}% · {shimmer}%
        </span>
      </div>
      <div
        ref={surfaceRef}
        className="xy-pad"
        role="application"
        aria-label={`Tone and shimmer surface. Tone ${tone} percent, shimmer ${shimmer} percent. Arrow keys adjust.`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onDoubleClick={() => onChange(defaults)}
        onKeyDown={onKeyDown}
      >
        <span className="default-mark" style={{ left: `${defaults.tone}%`, top: `${100 - defaults.shimmer}%` }} />
        <span className="handle" style={{ left: `${tone}%`, top: `${100 - shimmer}%` }} />
      </div>
      <div className="xy-pad-axes">
        <span>Dark</span>
        <span>Dry ↕ Shimmer</span>
        <span>Open</span>
      </div>
    </div>
  );
}
