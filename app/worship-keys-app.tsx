"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Status } from "@/components/common/status";
import { KeyboardStrip } from "@/components/midi/keyboard-strip";
import { TransposePanel } from "@/components/midi/transpose-panel";
import { AudioIoPanel } from "@/components/pads/audio-io-panel";
import { ImportDialog, buildLocalPreset } from "@/components/pads/import-dialog";
import { PAD_DEFAULTS, PadControls, type PadSettings } from "@/components/pads/pad-controls";
import { KeyRibbon } from "@/components/performance/key-ribbon";
import { NowCard } from "@/components/performance/now-card";
import { TransportDock } from "@/components/performance/transport-dock";
import { HostPanel, type HostBootstrap } from "@/components/session/host-panel";
import { SetlistRail } from "@/components/setlist/setlist-rail";
import { SongDialog } from "@/components/setlist/song-dialog";
import { VoicePanel } from "@/components/voice/voice-panel";

import { useMidi } from "@/lib/hooks/use-midi";
import { usePadEngine } from "@/lib/hooks/use-pad-engine";
import { useSession } from "@/lib/hooks/use-session";
import { useVoice } from "@/lib/hooks/use-voice";
import {
  type AudioDeviceInfo,
  chooseOutputDevice,
  listAudioDevices,
  watchDeviceChanges,
} from "@/lib/io/media-devices";
import { describeChannelSummary, describeExposedChannels, detectOutputSelectionSupport } from "@/lib/io/routing-capabilities";
import { ChordStabilizer } from "@/lib/music/chord-stabilizer";
import { chordNameForCandidate } from "@/lib/music/chord-name";
import { nashvilleForCandidate } from "@/lib/music/nashville";
import { spellKey, spellKeyShort } from "@/lib/music/notation";
import type { Mode, PitchClass } from "@/lib/music/pitch";
import { adjustMidiNote } from "@/lib/music/transpose";
import type { LeaderCommand } from "@/lib/session/protocol";
import { formatTimeSignature, type Preferences, type Song } from "@/lib/storage/schema";
import {
  IndexedDbSetlistRepository,
  InMemorySetlistRepository,
  createPersistedState,
  type SetlistRepository,
} from "@/lib/storage/setlist-repository";
import {
  activeSong as findActiveSong,
  addSong,
  createSong,
  createStarterSetlist,
  duplicateSong,
  neighbourSong,
  removeSong,
  selectSong,
  songPosition,
  updateSong,
} from "@/lib/storage/setlist-operations";
import {
  DEFAULT_TRIGGER_POLICY,
  beginTransition,
  cancelPreparation,
  completeTransition,
  createTransitionContext,
  evaluateQualifyingChord,
  prepare as prepareTransition,
  startCrescendo,
  startPad,
  stopPad,
} from "@/lib/transitions/transition-machine";
import type { ParsedCommand } from "@/lib/voice/command-parser";

const DEFAULT_PREFERENCES: Preferences = {
  notation: "auto",
  allowAnyTargetKeyChord: false,
  voiceLanguage: "en-US",
  requireWakeWord: true,
  inputTransposeByDevice: {},
  liveMode: false,
};

export function WorshipKeysApp() {
  /* ------------------------------------------------------------- app state */

  const [setlist, setSetlist] = useState(() => createStarterSetlist());
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [padSettings, setPadSettings] = useState<PadSettings>(PAD_DEFAULTS);
  const [transition, setTransition] = useState(createTransitionContext);
  const [muted, setMuted] = useState(false);
  const [editingSong, setEditingSong] = useState<{ song: Song; isNew: boolean } | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [audioStarted, setAudioStarted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const repositoryRef = useRef<SetlistRepository | null>(null);
  const stabilizerRef = useRef(new ChordStabilizer());
  // Mirror of the transition context for callbacks that must not re-create
  // themselves on every state change (keyboard shortcuts, session commands).
  const transitionRef = useRef(transition);
  useEffect(() => {
    transitionRef.current = transition;
  }, [transition]);

  const pads = usePadEngine();
  const midi = useMidi();
  const session = useSession();

  const song = findActiveSong(setlist);
  const concertKey = (song?.concertKey ?? 0) as PitchClass;
  const mode: Mode = song?.mode ?? "major";
  const spelling = useMemo(
    () => ({ preference: preferences.notation, keyTonic: concertKey, keyMode: mode }),
    [preferences.notation, concertKey, mode],
  );

  /* ---------------------------------------------------------- persistence */

  useEffect(() => {
    const repository: SetlistRepository =
      typeof indexedDB === "undefined" ? new InMemorySetlistRepository() : new IndexedDbSetlistRepository();
    repositoryRef.current = repository;
    void repository.load().then((outcome) => {
      if (outcome.status === "loaded") {
        setSetlist(outcome.state.setlist);
        setPreferences(outcome.state.preferences);
        if (outcome.notice) setStorageNotice(outcome.notice);
      } else if (outcome.status === "error") {
        setStorageNotice(outcome.message);
      }
    });
  }, []);

  // Debounced autosave: a service should never depend on remembering to save.
  useEffect(() => {
    if (!repositoryRef.current) return;
    setUnsaved(true);
    const timer = setTimeout(() => {
      void repositoryRef.current
        ?.save(createPersistedState(setlist, preferences))
        .then(() => setUnsaved(false))
        .catch(() => setStorageNotice("The setlist could not be saved locally."));
    }, 600);
    return () => clearTimeout(timer);
  }, [setlist, preferences]);

  /* ------------------------------------------------------------- pad audio */

  const applyPadSettings = useCallback(
    (patch: Partial<PadSettings>) => {
      setPadSettings((current) => {
        const next = { ...current, ...patch };
        if (patch.mainVolume != null && !muted) pads.engine.setMainVolume(patch.mainVolume);
        if (patch.shimmer != null) pads.engine.setShimmerLevel(patch.shimmer);
        if (patch.tone != null) pads.engine.setTone(patch.tone);
        if (patch.motion != null) pads.engine.setMotion(patch.motion);
        return next;
      });
    },
    [muted, pads.engine],
  );

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      pads.engine.setMainVolume(next ? 0 : padSettings.mainVolume);
      return next;
    });
  }, [padSettings.mainVolume, pads.engine]);

  /** Everything audible starts from here, so it always follows a user gesture. */
  const startAudio = useCallback(async () => {
    await pads.preloadPreset();
    pads.engine.setMainVolume(muted ? 0 : padSettings.mainVolume);
    pads.engine.setShimmerLevel(padSettings.shimmer);
    pads.engine.setTone(padSettings.tone);
    pads.engine.setMotion(padSettings.motion);
    setAudioStarted(true);
  }, [muted, padSettings, pads]);

  // Any preset change — built in or freshly imported — decodes its keys, so a
  // key press after switching packs never waits on a decode.
  const preloadPreset = pads.preloadPreset;
  useEffect(() => {
    if (!audioStarted) return;
    void preloadPreset();
  }, [audioStarted, preloadPreset]);

  const fadeIn = useCallback(async () => {
    await startAudio();
    await pads.engine.fadeIn(concertKey, { durationSeconds: padSettings.fadeInSeconds });
    setTransition((current) => startPad(current, { tonic: concertKey, mode }));
  }, [concertKey, mode, padSettings.fadeInSeconds, pads.engine, startAudio]);

  const fadeOut = useCallback(() => {
    pads.engine.fadeOut({ durationSeconds: padSettings.fadeOutSeconds });
    setTimeout(() => {
      // The fade may have been reversed in the meantime. The engine is the
      // authority on whether anything is still sounding, so ask it rather than
      // assuming this timer still describes reality.
      if (pads.engine.snapshot().state !== "stopped") return;
      setTransition((current) => stopPad(current));
    }, padSettings.fadeOutSeconds * 1000 + 120);
  }, [padSettings.fadeOutSeconds, pads.engine]);

  const stopNow = useCallback(() => {
    pads.engine.stopNow();
    setTransition((current) => stopPad(current));
  }, [pads.engine]);

  /* -------------------------------------------------------- key selection */

  const setConcertKey = useCallback(
    (tonic: PitchClass, nextMode: Mode = mode) => {
      if (!song) return;
      setSetlist((current) => updateSong(current, song.id, { concertKey: tonic, mode: nextMode }));
    },
    [mode, song],
  );

  const runCrossfade = useCallback(
    async (tonic: PitchClass, nextMode: Mode) => {
      setTransition((current) => beginTransition(current, performance.now(), padSettings.crossfadeSeconds));
      await pads.engine.crossfadeTo(tonic, padSettings.crossfadeSeconds);
      setTimeout(() => {
        // Only adopt the new key if the crossfade actually ran to the end; a
        // Stop now during the fade must not silently rewrite the song's key.
        if (transitionRef.current.state !== "transitioning") return;
        setConcertKey(tonic, nextMode);
        setTransition((current) => completeTransition(current));
      }, padSettings.crossfadeSeconds * 1000 + 120);
    },
    [padSettings.crossfadeSeconds, pads.engine, setConcertKey],
  );

  const prepareKey = useCallback(
    (tonic: PitchClass, nextMode: Mode = mode) => {
      setTransition((current) => prepareTransition(current, { tonic, mode: nextMode }, performance.now()));
    },
    [mode],
  );

  /** Key ribbon: when stopped this just sets the key; when playing it arms it. */
  const onKeySelected = useCallback(
    (tonic: PitchClass) => {
      if (transition.state === "stopped") {
        setConcertKey(tonic);
        return;
      }
      if (tonic === concertKey) return;
      prepareKey(tonic);
    },
    [concertKey, prepareKey, setConcertKey, transition.state],
  );

  const switchNow = useCallback(() => {
    const target = transitionRef.current.target;
    if (!target) return;
    void runCrossfade(target.tonic, target.mode);
  }, [runCrossfade]);

  const cancelTransition = useCallback(() => {
    if (transitionRef.current.state === "crescendo") pads.engine.cancelCrescendo();
    setTransition((current) => cancelPreparation(current));
  }, [pads.engine]);

  const runCrescendo = useCallback(() => {
    pads.engine.startCrescendo(padSettings.crescendoSeconds);
    setTransition((current) => startCrescendo(current, performance.now(), padSettings.crescendoSeconds));
  }, [padSettings.crescendoSeconds, pads.engine]);

  /* ------------------------------------------------------ chord detection */

  const soundingNotes = useMemo(
    () => midi.notes.sounding.map((note) => adjustMidiNote(note, transposeForDevice(preferences, midi.selectedInput?.id))),
    [midi.notes.sounding, midi.selectedInput?.id, preferences],
  );

  const [chord, setChord] = useState<ReturnType<ChordStabilizer["update"]>>(null);

  useEffect(() => {
    const now = performance.now();
    const bass = soundingNotes.length > 0 ? Math.min(...soundingNotes) : null;
    setChord(
      stabilizerRef.current.update(soundingNotes, now, {
        bassMidiNote: bass,
        keyTonic: concertKey,
        keyMode: mode,
      }),
    );
  }, [soundingNotes, concertKey, mode]);

  const nashville = chord ? nashvilleForCandidate(chord.candidate, concertKey, { preference: preferences.notation, simplified: preferences.liveMode }) : null;
  const chordLabel = chord ? chordNameForCandidate(chord.candidate, spelling) : null;
  const alternative = chord?.detection.candidates[1]
    ? chordNameForCandidate(chord.detection.candidates[1], spelling)
    : null;

  // Automatic prepared switch: only a settled, confident target tonic fires it.
  useEffect(() => {
    if (!chord) return;
    const context = transitionRef.current;
    if (context.state !== "armed" && context.state !== "crescendo") return;
    const sustainedOnly = midi.notes.pressed.length === 0 && midi.notes.sustained.length > 0;
    const result = evaluateQualifyingChord(
      context,
      { candidate: chord.candidate, stableSince: chord.since, sustainedOnly, now: performance.now() },
      { ...DEFAULT_TRIGGER_POLICY, allowAnyTargetKeyChord: preferences.allowAnyTargetKeyChord },
    );
    if (result.qualifies && context.target) {
      void runCrossfade(context.target.tonic, context.target.mode);
    }
  }, [chord, midi.notes.pressed.length, midi.notes.sustained.length, preferences.allowAnyTargetKeyChord, runCrossfade]);

  /* ------------------------------------------------------------ audio I/O */

  const [devices, setDevices] = useState<{ inputs: AudioDeviceInfo[]; outputs: AudioDeviceInfo[] }>({
    inputs: [],
    outputs: [],
  });
  const [voiceDeviceId, setVoiceDeviceId] = useState<string | null>(null);
  const [voiceTrack, setVoiceTrack] = useState<MediaStreamTrack | null>(null);

  const refreshDevices = useCallback(() => {
    void listAudioDevices().then((result) => setDevices({ inputs: result.inputs, outputs: result.outputs }));
  }, []);

  useEffect(() => {
    refreshDevices();
    return watchDeviceChanges(refreshDevices);
  }, [refreshDevices]);

  // Cheap capability read, deliberately not memoised: the AudioContext only
  // exists after the first gesture, so the answer changes during the session.
  const outputSupport = detectOutputSelectionSupport(pads.engine.audioContext);

  const channels = useMemo(() => describeExposedChannels(voiceTrack), [voiceTrack]);

  /* ---------------------------------------------------------------- voice */

  const handleVoiceCommand = useCallback(
    (parsed: ParsedCommand) => {
      const command = parsed.command;
      switch (command.type) {
        case "prepare":
          prepareKey(command.tonic, command.mode);
          break;
        case "switch-now":
          switchNow();
          break;
        case "crescendo":
          runCrescendo();
          break;
        case "cancel-transition":
          cancelTransition();
          break;
        case "stop-pads":
          stopNow();
          break;
        case "next-song":
        case "previous-song": {
          const target = neighbourSong(setlist, command.type === "next-song" ? 1 : -1);
          if (target) setSetlist((current) => selectSong(current, target.id));
          break;
        }
      }
    },
    [cancelTransition, prepareKey, runCrescendo, setlist, stopNow, switchNow],
  );

  const voice = useVoice({
    language: preferences.voiceLanguage,
    requireWakeWord: preferences.requireWakeWord,
    onCommand: handleVoiceCommand,
  });

  /* --------------------------------------------------------- host session */

  const [bootstrap, setBootstrap] = useState<HostBootstrap | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session/bootstrap")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Host controls are unavailable.");
        return body as HostBootstrap;
      })
      .then(setBootstrap)
      .catch((error: unknown) =>
        setBootstrapError(error instanceof Error ? error.message : "The live session could not be started."),
      );
  }, []);

  useEffect(() => {
    if (!bootstrap) return;
    session.connect(bootstrap.hostToken, "Host MacBook");
    return () => session.disconnect();
    // Connecting once per bootstrap is intended; session identity does not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap]);

  const applyLeaderCommand = useCallback(
    (command: LeaderCommand): { applied: boolean; reason?: string } => {
      switch (command.type) {
        case "select-song": {
          if (!setlist.songs.some((entry) => entry.id === command.songId)) return { applied: false, reason: "Unknown song." };
          setSetlist((current) => selectSong(current, command.songId));
          return { applied: true };
        }
        case "next-song":
        case "previous-song": {
          const target = neighbourSong(setlist, command.type === "next-song" ? 1 : -1);
          if (!target) return { applied: false, reason: "End of the setlist." };
          setSetlist((current) => selectSong(current, target.id));
          return { applied: true };
        }
        case "set-key":
          setConcertKey(command.tonic as PitchClass, command.mode);
          return { applied: true };
        case "prepare":
          prepareKey(command.tonic as PitchClass, command.mode);
          return { applied: true };
        case "cancel-preparation":
          cancelTransition();
          return { applied: true };
        case "switch-now":
          if (!transitionRef.current.target) return { applied: false, reason: "No key is prepared." };
          switchNow();
          return { applied: true };
        case "crescendo":
          runCrescendo();
          return { applied: true };
        case "fade-in":
          void fadeIn();
          return { applied: true };
        case "fade-out":
          fadeOut();
          return { applied: true };
        case "stop-pads":
          stopNow();
          return { applied: true };
      }
    },
    [cancelTransition, fadeIn, fadeOut, prepareKey, runCrescendo, setConcertKey, setlist, stopNow, switchNow],
  );

  // The handler is registered exactly once. Re-registering on every render
  // would tear it down again in the cleanup that runs just before the session
  // hook delivers an inbound command, and the host would never answer.
  const applyLeaderCommandRef = useRef(applyLeaderCommand);
  useEffect(() => {
    applyLeaderCommandRef.current = applyLeaderCommand;
  }, [applyLeaderCommand]);

  const { onRunCommand, acknowledge, sendHostState } = session;
  useEffect(() => {
    onRunCommand((messageId, command) => {
      const result = applyLeaderCommandRef.current(command);
      acknowledge(messageId, result.applied, result.reason);
    });
    return () => onRunCommand(null);
  }, [onRunCommand, acknowledge]);

  // Publish the real state to the session, throttled so older iPads stay calm.
  const publishedRef = useRef<string>("");
  const sessionRole = session.role;
  useEffect(() => {
    if (sessionRole !== "host") return;
    const position = songPosition(setlist, song?.id);
    const patch = {
      hostOnline: true,
      activeSong: song
        ? { id: song.id, title: song.title, artist: song.artist, position: position.position, total: position.total }
        : null,
      concertKey: spellKey(concertKey, mode, preferences.notation),
      mode,
      timeSignature: song ? formatTimeSignature(song.timeSignature) : "4/4",
      bpm: song?.bpm,
      detectedChord: chordLabel ?? undefined,
      nashville: nashville?.text,
      chordConfidence: chord?.candidate.confidence,
      preparedKey: transition.target ? spellKey(transition.target.tonic, transition.target.mode, preferences.notation) : undefined,
      transitionState:
        transition.state === "armed"
          ? ("armed" as const)
          : transition.state === "crescendo"
            ? ("crescendo" as const)
            : transition.state === "transitioning"
              ? ("transitioning" as const)
              : ("idle" as const),
      padState: pads.snapshot?.state ?? ("stopped" as const),
      transcript: voice.segments.map((segment) => ({
        id: segment.id,
        text: segment.text,
        final: segment.final,
        at: segment.at,
      })),
    };
    const fingerprint = JSON.stringify(patch);
    if (fingerprint === publishedRef.current) return;
    publishedRef.current = fingerprint;
    sendHostState(patch);
  }, [
    chord?.candidate.confidence,
    chordLabel,
    concertKey,
    mode,
    nashville?.text,
    pads.snapshot?.state,
    preferences.notation,
    sendHostState,
    sessionRole,
    setlist,
    song,
    transition.state,
    transition.target,
    voice.segments,
  ]);

  /* ----------------------------------------------------- keyboard shortcuts */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      switch (event.key.toLowerCase()) {
        case " ":
          event.preventDefault();
          if (transitionRef.current.state === "stopped") void fadeIn();
          else fadeOut();
          break;
        case "p":
          if (transitionRef.current.state === "playing") prepareKey(((concertKey + 7) % 12) as PitchClass);
          break;
        case "c":
          runCrescendo();
          break;
        case "enter":
          switchNow();
          break;
        case "escape":
          cancelTransition();
          break;
        case "v":
          if (voice.listening) voice.stop();
          else void voice.start(voiceDeviceId);
          break;
        case "l":
          setPreferences((current) => ({ ...current, liveMode: !current.liveMode }));
          break;
        case "arrowup":
        case "arrowdown": {
          // A modifier is required so a stray arrow key cannot change songs.
          if (!event.shiftKey && !event.metaKey) return;
          event.preventDefault();
          const next = neighbourSong(setlist, event.key === "ArrowDown" ? 1 : -1);
          if (next) setSetlist((current) => selectSong(current, next.id));
          break;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelTransition, concertKey, fadeIn, fadeOut, prepareKey, runCrescendo, setlist, switchNow, voice, voiceDeviceId]);

  /* ------------------------------------------------------------- rendering */

  const position = songPosition(setlist, song?.id);
  const padState = pads.snapshot?.state ?? "stopped";
  const preparedLabel = transition.target ? spellKey(transition.target.tonic, transition.target.mode, preferences.notation) : null;
  const transitionLabel =
    transition.state === "armed"
      ? "Armed"
      : transition.state === "crescendo"
        ? "Crescendo"
        : transition.state === "transitioning"
          ? "Crossfading"
          : transition.state === "playing"
            ? "Playing"
            : "Idle";

  if (preferences.liveMode) {
    return (
      <LiveModeScreen
        song={song}
        position={position}
        nashvilleText={nashville?.text ?? null}
        chordLabel={chordLabel}
        concertKeyLabel={spellKey(concertKey, mode, preferences.notation)}
        preparedLabel={preparedLabel}
        padState={padState}
        onExit={() => setPreferences((current) => ({ ...current, liveMode: false }))}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="rail rail-left">
        <BrandMark />
        <SetlistRail
          setlist={setlist}
          activeSongId={song?.id}
          onSelect={(songId) => setSetlist((current) => selectSong(current, songId))}
          onAddSong={() => setEditingSong({ song: createSong({ padPresetId: pads.presetId }), isNew: true })}
          onEditSong={(songId) => {
            const found = setlist.songs.find((entry) => entry.id === songId);
            if (found) setEditingSong({ song: found, isNew: false });
          }}
          onRename={(name) => setSetlist((current) => ({ ...current, name }))}
          unsaved={unsaved}
        />
        <div className="rail-foot">
          {song ? (
            <button type="button" className="btn tone-quiet" onClick={() => setEditingSong({ song, isNew: false })}>
              Edit current song
            </button>
          ) : null}
          <button
            type="button"
            className="btn tone-quiet"
            onClick={() => setPreferences((current) => ({ ...current, liveMode: true }))}
          >
            Live mode
          </button>
          <button
            type="button"
            className="btn tone-quiet"
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                notation: current.notation === "auto" ? "flats" : current.notation === "flats" ? "sharps" : "auto",
              }))
            }
          >
            Spelling: {preferences.notation}
          </button>
        </div>
      </aside>

      <main className="stage">
        <header className="stage-top">
          <div className="stage-title">
            <span className="eyebrow">
              {setlist.name} · Song {position.position} of {position.total}
            </span>
            <h1>{song?.title ?? "No song selected"}</h1>
            <div className="sub">
              <span>{spellKey(concertKey, mode, preferences.notation)}</span>
              <span className="mono">{song ? formatTimeSignature(song.timeSignature) : "4/4"}</span>
              {song?.artist ? <span>{song.artist}</span> : null}
              {song?.bpm ? <span className="mono">{song.bpm} bpm</span> : null}
            </div>
          </div>
          <div className="btn-row">
            {!audioStarted ? (
              <button type="button" className="btn is-active" onClick={() => void startAudio()}>
                Enable audio
              </button>
            ) : null}
            <span className="role-chip tone-live">
              {session.status === "connected" ? "HOST · LIVE" : session.status === "reconnecting" ? "HOST · RECONNECTING" : "HOST"}
            </span>
          </div>
        </header>

        <div className="stage-body">
          {storageNotice ? (
            <div className="callout tone-warn">
              <span>{storageNotice}</span>
              <span className="callout-actions">
                <button type="button" className="btn tone-quiet" onClick={() => setStorageNotice(null)}>
                  Dismiss
                </button>
              </span>
            </div>
          ) : null}
          {midi.notice ? (
            <div className="callout tone-warn">
              <span>{midi.notice}</span>
              <span className="callout-actions">
                <button type="button" className="btn tone-quiet" onClick={midi.dismissNotice}>
                  Dismiss
                </button>
              </span>
            </div>
          ) : null}
          {pads.error ? (
            <div className="callout tone-danger">
              <span>{pads.error.message}</span>
              <span className="callout-actions">
                <button type="button" className="btn tone-quiet" onClick={pads.clearError}>
                  Dismiss
                </button>
              </span>
            </div>
          ) : null}

          <NowCard
            nashville={nashville}
            chordName={chordLabel}
            confidence={chord?.candidate.confidence ?? 0}
            ambiguous={chord?.detection.ambiguous ?? false}
            alternative={alternative}
            concertKey={spellKey(concertKey, mode, preferences.notation)}
            timeSignature={song ? formatTimeSignature(song.timeSignature) : "4/4"}
            preparedKey={preparedLabel}
            transitionLabel={transitionLabel}
          />

          <div>
            <div className="section-title">
              <span>Concert key</span>
              <span>{pads.loadingKeys ? "Loading pads…" : audioStarted ? `${pads.readyKeys.size} of 12 ready` : "Enable audio to load pads"}</span>
            </div>
            <KeyRibbon
              currentKey={concertKey}
              preparedKey={transition.target?.tonic ?? null}
              mode={mode}
              readyKeys={audioStarted ? pads.readyKeys : new Set(Array.from({ length: 12 }, (_, index) => index as PitchClass))}
              onSelect={onKeySelected}
            />
          </div>

          <div>
            <div className="section-title">
              <span>MIDI keyboard</span>
              <span>{midi.notes.sustainDown ? "Sustain down" : "Sustain up"}</span>
            </div>
            <KeyboardStrip
              pressed={midi.notes.pressed}
              sustained={midi.notes.sustained}
              deviceName={midi.selectedInput?.name ?? null}
              transposeNote={
                transposeForDevice(preferences, midi.selectedInput?.id) !== 0
                  ? `transpose ${transposeForDevice(preferences, midi.selectedInput?.id) > 0 ? "+" : ""}${transposeForDevice(preferences, midi.selectedInput?.id)}`
                  : null
              }
            />
          </div>

          <TransportDock
            padState={padState}
            progress={pads.snapshot?.progress ?? 0}
            transitionState={transition.state}
            preparedLabel={preparedLabel}
            canPrepare={transition.state === "playing" || transition.state === "armed"}
            crescendoActive={pads.snapshot?.crescendoActive ?? false}
            onFadeIn={() => void fadeIn()}
            onFadeOut={fadeOut}
            onStopNow={stopNow}
            onPrepare={() => prepareKey(((concertKey + 7) % 12) as PitchClass)}
            onCrescendo={runCrescendo}
            onSwitchNow={switchNow}
            onCancel={cancelTransition}
          />

          <div className="status-line">
            <Status
              tone={midi.selectedInput ? "ok" : midi.permission === "unsupported" ? "warn" : "idle"}
              state="MIDI"
              detail={midi.selectedInput?.name ?? (midi.permission === "unsupported" ? "Not supported" : "Not connected")}
            />
            <Status
              tone={padState === "stopped" ? "idle" : "active"}
              state="Pads"
              detail={`${padState} · ${spellKeyShort(concertKey, mode, preferences.notation)}`}
            />
            <Status
              tone={pads.snapshot?.sinkLabel === "System default" ? "info" : "ok"}
              state="Output"
              detail={pads.snapshot?.sinkLabel ?? "System default"}
            />
            <Status
              tone={voice.listening ? "active" : "idle"}
              state="Voice"
              detail={voice.listening ? "Listening" : voice.supported ? "Off" : "Not supported"}
            />
            <Status
              tone={session.status === "connected" ? "ok" : session.status === "idle" ? "idle" : "warn"}
              state="Session"
              detail={`${session.devices.filter((device) => device.role !== "host").length} device(s)`}
            />
          </div>
        </div>
      </main>

      <aside className="rail rail-right">
        <PadControls
          padState={padState}
          presets={pads.presets}
          presetId={pads.presetId}
          onPresetChange={(id) => {
            pads.setPresetId(id);
            if (song) setSetlist((current) => updateSong(current, song.id, { padPresetId: id }));
          }}
          settings={padSettings}
          onChange={applyPadSettings}
          muted={muted}
          onToggleMute={toggleMute}
          shimmerMode={pads.snapshot?.shimmerMode ?? "reverb-only"}
          onImportPads={() => setImportOpen(true)}
        />

        <AudioIoPanel
          midiPermission={midi.permission}
          midiInputs={midi.inputs}
          selectedMidiInput={midi.selectedInput}
          onRequestMidi={() => void midi.requestAccess()}
          onSelectMidiInput={midi.selectInput}
          voiceDevices={devices.inputs}
          voiceDeviceId={voiceDeviceId}
          onSelectVoiceDevice={(id) => setVoiceDeviceId(id || null)}
          voiceLabel={voice.deviceLabel}
          voiceChannels={describeChannelSummary(channels)}
          voiceUsesSelectedTrack={voice.usesSelectedTrack}
          outputLabel={pads.snapshot?.sinkLabel ?? "System default"}
          canChooseOutput={outputSupport.canChooseOutput}
          outputHelp={outputSupport.reason}
          onChooseOutput={() => {
            void chooseOutputDevice().then((device) => {
              if (device) void pads.engine.setOutputDevice(device.deviceId, device.label);
              refreshDevices();
            });
          }}
          onResetOutput={() => void pads.engine.resetOutputToSystemDefault()}
          onTestOutput={() => void pads.engine.playTestSignal()}
          meter={pads.meter}
        />

        <TransposePanel
          inputTranspose={transposeForDevice(preferences, midi.selectedInput?.id)}
          onChange={(value) =>
            setPreferences((current) => ({
              ...current,
              inputTransposeByDevice: {
                ...current.inputTransposeByDevice,
                [midi.selectedInput?.id ?? "default"]: value,
              },
            }))
          }
          lastRawNote={midi.lastRawNote}
          deviceName={midi.selectedInput?.name ?? null}
          concertKeyLabel={spellKey(concertKey, mode, preferences.notation)}
        />

        <VoicePanel
          supported={voice.supported}
          listening={voice.listening}
          segments={voice.segments}
          interim={voice.interim}
          pending={voice.pending}
          onConfirmPending={voice.confirmPending}
          onDismissPending={voice.dismissPending}
          onStart={() => {
            void voice.start(voiceDeviceId).then(() => {
              void listAudioDevices().then((result) => setDevices({ inputs: result.inputs, outputs: result.outputs }));
            });
          }}
          onStop={() => {
            voice.stop();
            setVoiceTrack(null);
          }}
          language={preferences.voiceLanguage}
          onLanguageChange={(value) => setPreferences((current) => ({ ...current, voiceLanguage: value }))}
          requireWakeWord={preferences.requireWakeWord}
          onRequireWakeWordChange={(value) => setPreferences((current) => ({ ...current, requireWakeWord: value }))}
          deviceLabel={voice.deviceLabel}
          error={voice.error}
        />

        <HostPanel
          bootstrap={bootstrap}
          bootstrapError={bootstrapError}
          connected={session.status === "connected"}
          devices={session.devices}
          remoteLocked={session.snapshot?.remoteControlLocked ?? false}
          joinsLocked={false}
          onToggleRemoteLock={() =>
            session.sendHostCommand({ type: "set-remote-lock", locked: !(session.snapshot?.remoteControlLocked ?? false) })
          }
          onToggleJoinsLock={() => session.sendHostCommand({ type: "lock-new-joins", locked: true })}
          onApproveLeader={(deviceId, approved) => session.sendHostCommand({ type: "set-leader", deviceId, approved })}
          onRevokeDevice={(deviceId) => session.sendHostCommand({ type: "revoke-device", deviceId })}
          onRotatePin={() => {
            void fetch("/api/session/pin", { method: "POST" })
              .then((response) => response.json())
              .then((body: { leaderPin?: string }) => {
                if (body.leaderPin && bootstrap) setBootstrap({ ...bootstrap, leaderPin: body.leaderPin });
              });
          }}
        />

        <section className="panel-card" aria-label="Trigger policy">
          <div className="section-title" style={{ padding: 0 }}>
            <span>Prepared switch</span>
          </div>
          <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={preferences.allowAnyTargetKeyChord}
              onChange={(event) =>
                setPreferences((current) => ({ ...current, allowAnyTargetKeyChord: event.target.checked }))
              }
              style={{ width: "auto" }}
            />
            Allow the target key&rsquo;s 4 and 5 to trigger the switch
          </label>
          <p className="hint">
            Off by default: only the tonic of the prepared key switches automatically. Switch now is always available.
          </p>
        </section>
      </aside>

      {editingSong ? (
        <SongDialog
          song={editingSong.song}
          presets={pads.presets}
          isNew={editingSong.isNew}
          onClose={() => setEditingSong(null)}
          onSave={(next) => {
            setSetlist((current) =>
              editingSong.isNew ? addSong(current, next) : updateSong(current, next.id, next),
            );
            setEditingSong(null);
          }}
          onDelete={() => {
            setSetlist((current) => removeSong(current, editingSong.song.id));
            setEditingSong(null);
          }}
          onDuplicate={() => {
            setSetlist((current) => duplicateSong(current, editingSong.song.id));
            setEditingSong(null);
          }}
        />
      ) : null}

      {importOpen ? (
        <ImportDialog
          decode={pads.decodeForImport}
          onClose={() => setImportOpen(false)}
          onImport={(name, imported) => {
            const id = `local-${Date.now().toString(36)}`;
            pads.importLocalPack(buildLocalPreset(id, name, imported), imported);
            setImportOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Input transpose is remembered per MIDI device (spec 11.1). */
function transposeForDevice(preferences: Preferences, deviceId: string | undefined): number {
  return preferences.inputTransposeByDevice[deviceId ?? "default"] ?? 0;
}

/**
 * Live mode: fewer things, all of them larger (spec 6.5). Settings disappear
 * rather than being shown greyed out.
 */
function LiveModeScreen({
  song,
  position,
  nashvilleText,
  chordLabel,
  concertKeyLabel,
  preparedLabel,
  padState,
  onExit,
}: {
  song: Song | null;
  position: { position: number; total: number };
  nashvilleText: string | null;
  chordLabel: string | null;
  concertKeyLabel: string;
  preparedLabel: string | null;
  padState: string;
  onExit: () => void;
}) {
  return (
    <div className="live-shell">
      <div className="live-top">
        <BrandMark size={40} />
        <div className="btn-row">
          <span className="role-chip tone-live">HOST · LIVE MODE</span>
          <button type="button" className="btn" onClick={onExit}>
            Exit live mode
          </button>
        </div>
      </div>

      <div className="live-main">
        <span className="label">
          {song?.title ?? "No song"} · {position.position} of {position.total}
        </span>
        <div className={`live-nashville${nashvilleText ? "" : " is-idle"}`} aria-live="polite">
          {nashvilleText ?? "—"}
        </div>
        <div className="live-chord">{chordLabel ?? "Listening"}</div>
        <div className="live-key">
          {concertKeyLabel}
          {song ? ` · ${formatTimeSignature(song.timeSignature)}` : ""}
        </div>
        {preparedLabel ? <div className="live-prepared">Prepared: {preparedLabel}</div> : null}
      </div>

      <div className="live-foot">
        <div className="status-line">
          <Status tone={padState === "stopped" ? "idle" : "active"} state="Pads" detail={padState} />
          <Status tone="info" state="Shortcuts" detail="Space fade · P prepare · Enter switch · Esc cancel · L exit" />
        </div>
      </div>
    </div>
  );
}
