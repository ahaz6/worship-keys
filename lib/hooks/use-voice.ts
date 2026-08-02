"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { closeVoiceInput, openVoiceInput } from "@/lib/io/media-devices";
import { type ParsedCommand, parseVoiceCommand } from "@/lib/voice/command-parser";
import { WebSpeechAdapter, type SpeechAdapterState, type TranscriptSegment } from "@/lib/voice/speech-adapter";

/**
 * Voice commands as progressive enhancement (spec 16).
 *
 * The microphone is never opened without an explicit click, the transcript is
 * held in memory only, and a recognition failure must not disturb MIDI or the
 * pads in any way.
 */
const TRANSCRIPT_LIMIT = 6;

export function useVoice({
  language,
  requireWakeWord,
  onCommand,
}: {
  language: string;
  requireWakeWord: boolean;
  onCommand: (parsed: ParsedCommand) => void;
}) {
  const [adapter] = useState(() => new WebSpeechAdapter());
  const streamRef = useRef<MediaStream | null>(null);
  const commandRef = useRef(onCommand);
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<SpeechAdapterState>("idle");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState<string>("");
  const [pending, setPending] = useState<ParsedCommand | null>(null);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const [usesSelectedTrack, setUsesSelectedTrack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest handler without re-subscribing the recogniser each render.
  useEffect(() => {
    commandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check, only knowable after mount
    setSupported(adapter.isSupported());
  }, [adapter]);

  useEffect(() => {
    adapter.setEvents({
      onStateChange: setState,
      onError: setError,
      onSegment: (segment) => {
        if (!segment.final) {
          setInterim(segment.text);
          return;
        }
        setInterim("");
        const parsed = parseVoiceCommand(segment.text, segment.confidence, { requireWakeWord });
        setSegments((current) => [...current, { ...segment }].slice(-TRANSCRIPT_LIMIT));
        if (!parsed) return;
        if (parsed.actionable) {
          commandRef.current(parsed);
          setPending(null);
        } else {
          // Held commands wait for a visible confirmation rather than firing.
          setPending(parsed);
        }
      },
    });
  }, [adapter, requireWakeWord]);

  const start = useCallback(
    async (deviceId: string | null) => {
      setError(null);
      try {
        const input = await openVoiceInput(deviceId, 2);
        streamRef.current = input.stream;
        setDeviceLabel(input.label);
        await adapter.start({ language, track: input.track });
        setUsesSelectedTrack(adapter.readsSelectedTrack);
      } catch (issue) {
        closeVoiceInput(streamRef.current);
        streamRef.current = null;
        setDeviceLabel(null);
        setError(
          issue instanceof Error && issue.name === "NotAllowedError"
            ? "Microphone access is blocked. Allow it in your browser settings."
            : issue instanceof Error
              ? issue.message
              : "The microphone could not be opened.",
        );
        setState("error");
      }
    },
    [adapter, language],
  );

  const stop = useCallback(() => {
    adapter.stop();
    closeVoiceInput(streamRef.current);
    streamRef.current = null;
    setDeviceLabel(null);
    setUsesSelectedTrack(false);
    setInterim("");
    setPending(null);
    setState("idle");
  }, [adapter]);

  useEffect(() => {
    return () => {
      adapter.stop();
      closeVoiceInput(streamRef.current);
    };
  }, [adapter]);

  const confirmPending = useCallback(() => {
    if (!pending) return;
    commandRef.current({ ...pending, actionable: true, hold: null });
    setPending(null);
  }, [pending]);

  return {
    supported,
    state,
    listening: state === "listening",
    segments,
    interim,
    pending,
    confirmPending,
    dismissPending: () => setPending(null),
    deviceLabel,
    usesSelectedTrack,
    error,
    clearError: () => setError(null),
    start,
    stop,
    clearTranscript: () => setSegments([]),
  };
}
