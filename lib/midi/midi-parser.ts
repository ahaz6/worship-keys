/**
 * MIDI byte parsing (spec section 9.2).
 *
 * The Web MIDI API hands over raw bytes and no musical meaning, so this module
 * turns the handful of messages Worship Keys cares about into typed events and
 * ignores everything else.
 */

export type MidiEvent =
  | { type: "note-on"; note: number; velocity: number; channel: number }
  | { type: "note-off"; note: number; channel: number }
  | { type: "sustain"; down: boolean; channel: number }
  | { type: "all-notes-off"; channel: number };

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;

export const CC_SUSTAIN = 64;
export const CC_ALL_NOTES_OFF = 123;

/** Sustain pedals are switch controllers: 64 and above counts as pressed. */
const SUSTAIN_THRESHOLD = 64;

export function parseMidiMessage(data: ArrayLike<number>): MidiEvent | null {
  if (data.length < 2) return null;
  const status = data[0] as number;
  const command = status & 0xf0;
  const channel = status & 0x0f;
  const first = data[1] as number;
  const second = data.length > 2 ? (data[2] as number) : 0;

  switch (command) {
    case NOTE_ON:
      // Note On with velocity 0 is the widely used alternative Note Off.
      return second > 0
        ? { type: "note-on", note: first, velocity: second, channel }
        : { type: "note-off", note: first, channel };
    case NOTE_OFF:
      return { type: "note-off", note: first, channel };
    case CONTROL_CHANGE:
      if (first === CC_SUSTAIN) return { type: "sustain", down: second >= SUSTAIN_THRESHOLD, channel };
      if (first === CC_ALL_NOTES_OFF) return { type: "all-notes-off", channel };
      return null;
    default:
      return null;
  }
}
