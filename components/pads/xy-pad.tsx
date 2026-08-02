"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type XySurfaceProps = {
  title: string;
  x: number;
  y: number;
  xName: string;
  yName: string;
  leftLabel: string;
  centreLabel: string;
  rightLabel: string;
  onChange: (next: { x: number; y: number }) => void;
  defaults: { x: number; y: number };
  disabled?: boolean;
};

function XySurface({
  title,
  x,
  y,
  xName,
  yName,
  leftLabel,
  centreLabel,
  rightLabel,
  onChange,
  defaults,
  disabled = false,
}: XySurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [display, setDisplay] = useState({ x, y });
  const latestChange = useRef(onChange);
  const pendingValue = useRef<{ x: number; y: number } | null>(null);
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreExternalUntil = useRef(0);

  useEffect(() => {
    latestChange.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (draggingRef.current) return;
    const wait = ignoreExternalUntil.current - Date.now();
    if (wait <= 0) {
      setDisplay({ x, y });
      return;
    }
    const timer = setTimeout(() => setDisplay({ x, y }), wait);
    return () => clearTimeout(timer);
  }, [x, y]);

  useEffect(
    () => () => {
      if (emitTimer.current) clearTimeout(emitTimer.current);
    },
    [],
  );

  const emitThrottled = useCallback((next: { x: number; y: number }) => {
    pendingValue.current = next;
    if (emitTimer.current) return;
    emitTimer.current = setTimeout(() => {
      emitTimer.current = null;
      const pending = pendingValue.current;
      pendingValue.current = null;
      if (pending) latestChange.current(pending);
    }, 50);
  }, []);

  const flushChange = useCallback(() => {
    if (emitTimer.current) clearTimeout(emitTimer.current);
    emitTimer.current = null;
    const pending = pendingValue.current;
    pendingValue.current = null;
    if (pending) latestChange.current(pending);
  }, []);

  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;
      const bounds = surfaceRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const x = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height));
      const next = { x: Math.round(x * 100), y: Math.round((1 - y) * 100) };
      setDisplay(next);
      emitThrottled(next);
    },
    [disabled, emitThrottled],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyFromPointer(event.clientX, event.clientY);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (!draggingRef.current) return;
    applyFromPointer(event.clientX, event.clientY);
  };

  const onPointerEnd = () => {
    draggingRef.current = false;
    ignoreExternalUntil.current = Date.now() + 250;
    flushChange();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const next = {
      x: Math.max(0, Math.min(100, display.x + move.x)),
      y: Math.max(0, Math.min(100, display.y + move.y)),
    };
    setDisplay(next);
    latestChange.current(next);
  };

  return (
    <div className="field">
      <div className="field-head">
        <b>{title}</b>
        <span className="value">
          {display.x}% · {display.y}%
        </span>
      </div>
      <div
        ref={surfaceRef}
        className="xy-pad"
        role="application"
        aria-label={`${title}. ${xName} ${display.x} percent, ${yName} ${display.y} percent. Arrow keys adjust.`}
        tabIndex={0}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={() => {
          if (!disabled) {
            setDisplay(defaults);
            latestChange.current(defaults);
          }
        }}
        onKeyDown={onKeyDown}
      >
        <span className="handle" style={{ left: `${display.x}%`, top: `${100 - display.y}%` }} />
      </div>
      <div className="xy-pad-axes">
        <span>{leftLabel}</span>
        <span>{centreLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

/** Horizontal is tone, vertical is shimmer. Double click restores defaults. */
export function XyPad({
  tone,
  shimmer,
  onChange,
  defaults,
  disabled = false,
}: {
  tone: number;
  shimmer: number;
  onChange: (next: { tone: number; shimmer: number }) => void;
  defaults: { tone: number; shimmer: number };
  disabled?: boolean;
}) {
  return (
    <XySurface
      title="Tone & Shimmer"
      x={tone}
      y={shimmer}
      xName="Tone"
      yName="Shimmer"
      leftLabel="Dark"
      centreLabel="Dry ↕ Shimmer"
      rightLabel="Open"
      onChange={({ x, y }) => onChange({ tone: x, shimmer: y })}
      defaults={{ x: defaults.tone, y: defaults.shimmer }}
      disabled={disabled}
    />
  );
}

/** Horizontal is brightness, vertical is stereo width. */
export function BrightnessWidthPad({
  brightness,
  width,
  onChange,
  defaults,
  disabled = false,
}: {
  brightness: number;
  width: number;
  onChange: (next: { brightness: number; width: number }) => void;
  defaults: { brightness: number; width: number };
  disabled?: boolean;
}) {
  return (
    <XySurface
      title="Brightness & Stereo Width"
      x={brightness}
      y={width}
      xName="Brightness"
      yName="Stereo width"
      leftLabel="Soft"
      centreLabel="Narrow ↕ Wide"
      rightLabel="Bright"
      onChange={({ x, y }) => onChange({ brightness: x, width: y })}
      defaults={{ x: defaults.brightness, y: defaults.width }}
      disabled={disabled}
    />
  );
}
