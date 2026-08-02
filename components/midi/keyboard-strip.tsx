"use client";

import { isAccidental, midiToPitchClass } from "@/lib/music/pitch";

/**
 * Live view of what the keyboard is actually sending (spec 6.3).
 *
 * Notes held by the sustain pedal are drawn differently from notes under the
 * player's fingers, because that distinction is exactly what decides whether a
 * prepared key change is allowed to fire.
 */

const LOW_NOTE = 36; // C2
const HIGH_NOTE = 96; // C7

/** White keys carry the layout; black keys are positioned on top of them. */
function whiteKeys(): number[] {
  const keys: number[] = [];
  for (let note = LOW_NOTE; note <= HIGH_NOTE; note += 1) {
    if (!isAccidental(midiToPitchClass(note))) keys.push(note);
  }
  return keys;
}

export function KeyboardStrip({
  pressed,
  sustained,
  deviceName,
  transposeNote,
}: {
  pressed: readonly number[];
  sustained: readonly number[];
  deviceName: string | null;
  transposeNote?: string | null;
}) {
  const whites = whiteKeys();
  const pressedSet = new Set(pressed);
  const sustainedSet = new Set(sustained);
  const whiteWidth = 100 / whites.length;

  return (
    <div>
      <div className="keyboard" aria-hidden="true">
        <div className="keyboard-inner">
          {whites.map((note) => (
            <span
              key={note}
              className={`wkey${pressedSet.has(note) ? " is-on" : sustainedSet.has(note) ? " is-sustained" : ""}`}
            />
          ))}
          {Array.from({ length: HIGH_NOTE - LOW_NOTE + 1 }, (_, offset) => LOW_NOTE + offset)
            .filter((note) => isAccidental(midiToPitchClass(note)))
            .map((note) => {
              // Sit the black key on the boundary between its two white neighbours.
              const whiteIndex = whites.findIndex((white) => white > note);
              const left = (whiteIndex < 0 ? whites.length : whiteIndex) * whiteWidth;
              return (
                <span
                  key={note}
                  className={`bkey${pressedSet.has(note) ? " is-on" : sustainedSet.has(note) ? " is-sustained" : ""}`}
                  style={{ left: `calc(${left}% - ${whiteWidth * 0.3}%)`, width: `${whiteWidth * 0.6}%` }}
                />
              );
            })}
        </div>
      </div>
      <div className="keyboard-caption">
        <span>{deviceName ? `Playing ${deviceName}` : "No MIDI keyboard connected"}</span>
        <span className="mono">
          {pressed.length} held
          {sustained.length > 0 ? ` · ${sustained.length} sustained` : ""}
          {transposeNote ? ` · ${transposeNote}` : ""}
        </span>
      </div>
    </div>
  );
}
