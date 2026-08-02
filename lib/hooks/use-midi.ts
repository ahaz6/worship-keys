"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActiveNotes, type ActiveNotesSnapshot } from "@/lib/midi/active-notes";
import { MidiConnection, type MidiInputInfo, type MidiPermissionState, isWebMidiSupported } from "@/lib/midi/midi-access";

/**
 * Web MIDI wiring for the page.
 *
 * Note state is kept in a ref and mirrored into React on a fixed cadence.
 * Re-rendering on every raw MIDI byte would make a fast run of notes fight the
 * renderer for the main thread, which is the last thing wanted during a song.
 */
const MIRROR_INTERVAL_MS = 40;

const EMPTY_SNAPSHOT: ActiveNotesSnapshot = {
  sounding: [],
  pressed: [],
  sustained: [],
  bassNote: null,
  sustainDown: false,
  lastNoteOnAt: null,
};

export function useMidi() {
  const notesRef = useRef(new ActiveNotes());
  const [connection] = useState(() => new MidiConnection());
  // Support is only knowable in the browser, so the server render starts at
  // "idle" and the mount check below narrows it.
  const [permission, setPermission] = useState<MidiPermissionState>("idle");
  const [inputs, setInputs] = useState<MidiInputInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<MidiInputInfo | null>(null);
  const [notes, setNotes] = useState<ActiveNotesSnapshot>(EMPTY_SNAPSHOT);
  const [lastRawNote, setLastRawNote] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check, only knowable after mount
    if (!isWebMidiSupported()) setPermission("unsupported");
  }, []);

  useEffect(() => {
    connection.setHandlers({
      onEvent: (event) => {
        const at = performance.now();
        const active = notesRef.current;
        switch (event.type) {
          case "note-on":
            setLastRawNote(event.note);
            active.noteOn(event.note, event.velocity, event.channel, at);
            break;
          case "note-off":
            active.noteOff(event.note);
            break;
          case "sustain":
            active.setSustain(event.down);
            break;
          case "all-notes-off":
            active.allNotesOff();
            break;
        }
      },
      onConnection: (event) => {
        if (event.type === "inputs") {
          setInputs(event.inputs);
          return;
        }
        // A device pulled mid-chord would otherwise leave notes and the pedal
        // stuck down forever.
        notesRef.current.reset();
        setSelectedInput(null);
        setNotice(`${event.name} was disconnected. Held notes were cleared.`);
      },
    });
  }, [connection]);

  useEffect(() => {
    const timer = setInterval(() => setNotes(notesRef.current.snapshot()), MIRROR_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => connection.dispose(), [connection]);

  /** Called from a click: browsers require a gesture for the permission prompt. */
  const requestAccess = useCallback(async () => {
    if (!isWebMidiSupported()) {
      setPermission("unsupported");
      return;
    }
    setPermission("requesting");
    try {
      const available = await connection.request();
      setInputs(available);
      setPermission("granted");
      const first = available[0];
      if (first) {
        connection.selectInput(first.id);
        setSelectedInput(first);
      }
      setNotice(null);
    } catch {
      setPermission("denied");
      setNotice("MIDI access was not granted. Allow it in your browser settings to use a keyboard.");
    }
  }, [connection]);

  const selectInput = useCallback(
    (id: string) => {
      notesRef.current.reset();
      const info = connection.selectInput(id);
      setSelectedInput(info);
      setNotice(null);
    },
    [connection],
  );

  const panic = useCallback(() => {
    notesRef.current.reset();
    setNotes(EMPTY_SNAPSHOT);
  }, []);

  return {
    permission,
    inputs,
    selectedInput,
    notes,
    lastRawNote,
    notice,
    dismissNotice: () => setNotice(null),
    requestAccess,
    selectInput,
    panic,
  };
}
