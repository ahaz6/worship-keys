"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Status } from "@/components/common/status";
import { KeyboardStrip } from "@/components/midi/keyboard-strip";
import { TransposePanel } from "@/components/midi/transpose-panel";
import { AudioIoPanel } from "@/components/pads/audio-io-panel";
import {
  DEFAULT_PAD_TEMPO_BPM,
  PAD_DEFAULTS,
  PadControls,
  type PadSettings,
} from "@/components/pads/pad-controls";
import { KeyRibbon } from "@/components/performance/key-ribbon";
import { NowCard } from "@/components/performance/now-card";
import { TransportDock } from "@/components/performance/transport-dock";
import { HostPanel, type HostBootstrap } from "@/components/session/host-panel";
import { OpenDriveSetlistButton } from "@/components/setlist/open-drive-setlist-button";
import { SetlistRail } from "@/components/setlist/setlist-rail";
import { SongDialog } from "@/components/setlist/song-dialog";
import { SetlistTransfer } from "@/components/setlist/setlist-transfer";
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
import { simpleBassNumberForMidiNote } from "@/lib/music/nashville";
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
import { isSpokenCountdown, type ParsedCommand } from "@/lib/voice/command-parser";

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

  const repositoryRef = useRef<SetlistRepository | null>(null);
  const stabilizerRef = useRef(new ChordStabilizer());
  // Mirror of the transition context for callbacks that must not re-create
  // themselves on every state change (keyboard shortcuts, session commands).
  const transitionRef = useRef(transition);
  const padSettingsSongIdRef = useRef<string | null>(null);
  const padSettingsRef = useRef(padSettings);
  const spatialRampTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crescendoReturnPointRef = useRef<{ brightness: number; width: number } | null>(null);
  useEffect(() => {
    transitionRef.current = transition;
  }, [transition]);
  useEffect(() => {
    padSettingsRef.current = padSettings;
  }, [padSettings]);
  useEffect(
    () => () => {
      if (spatialRampTimerRef.current) clearInterval(spatialRampTimerRef.current);
    },
    [],
  );

  const pads = usePadEngine();
  const midi = useMidi();
  const session = useSession();

  const song = findActiveSong(setlist);
  const concertKey = (song?.concertKey ?? 0) as PitchClass;
  const mode: Mode = song?.mode ?? "major";
  const padTempoBpm = song?.bpm ?? DEFAULT_PAD_TEMPO_BPM;
  const padTempoTier = padTempoBpm <= 80 ? "natural-slow" : padTempoBpm <= 120 ? "gentle-slow" : "soft-slow";
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
      padSettingsRef.current = { ...padSettingsRef.current, ...patch };
      setPadSettings((current) => ({ ...current, ...patch }));
      if (patch.mainVolume != null && !muted) pads.engine.setMainVolume(patch.mainVolume);
      if (patch.shimmer != null) pads.engine.setShimmerLevel(patch.shimmer);
      if (patch.tone != null) pads.engine.setTone(patch.tone);
      if (patch.brightness != null) pads.engine.setBrightness(patch.brightness);
      if (patch.width != null) pads.engine.setWidth(patch.width);
      // Motion is intentionally not performance-adjustable: keep its subtle,
      // tempo-synchronised breathing fixed on the warm Slow setting.
      pads.engine.setMotion(PAD_DEFAULTS.motion);
      if (song) {
        const songPatch: Partial<Song> = {};
        if (patch.mainVolume != null) songPatch.mainVolume = patch.mainVolume;
        if (patch.fadeInSeconds != null) songPatch.fadeInSeconds = patch.fadeInSeconds;
        if (patch.fadeOutSeconds != null) songPatch.fadeOutSeconds = patch.fadeOutSeconds;
        if (patch.crossfadeSeconds != null) songPatch.crossfadeSeconds = patch.crossfadeSeconds;
        if (Object.keys(songPatch).length > 0) {
          setSetlist((setlistState) => updateSong(setlistState, song.id, songPatch));
        }
      }
    },
    [muted, pads.engine, song],
  );

  // A song owns its pad choice and optional sound settings. Loading or
  // selecting it must therefore activate those values, not merely change the
  // title and key on screen.
  const availablePadPresets = pads.presets;
  const activePadPresetId = pads.presetId;
  const setActivePadPresetId = pads.setPresetId;
  useEffect(() => {
    if (!song || availablePadPresets.length === 0) return;
    const requested = availablePadPresets.find((entry) => entry.id === song.padPresetId);
    const compatible = requested && (requested.mode === "neutral" || requested.mode === song.mode);
    const selected = compatible
      ? requested
      : availablePadPresets.find((entry) => entry.mode === "neutral") ?? availablePadPresets[0];
    if (selected && selected.id !== activePadPresetId) setActivePadPresetId(selected.id);
    if (selected && song.padPresetId !== selected.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- migrates removed preset ids once after the manifest loads
      setSetlist((current) => updateSong(current, song.id, { padPresetId: selected.id }));
    }

    // Performance controls reset only when another song actually becomes
    // active. Unrelated song edits and live XY movements stay uninterrupted.
    if (padSettingsSongIdRef.current === song.id) return;
    padSettingsSongIdRef.current = song.id;

    const next: PadSettings = {
      ...PAD_DEFAULTS,
      mainVolume: song.mainVolume ?? PAD_DEFAULTS.mainVolume,
      // Shimmer is one uninterrupted live effect across the whole setlist.
      // A song change may move the pad key, but never this effect amount.
      shimmer: padSettingsRef.current.shimmer,
      tone: PAD_DEFAULTS.tone,
      brightness: PAD_DEFAULTS.brightness,
      width: PAD_DEFAULTS.width,
      motion: PAD_DEFAULTS.motion,
      fadeInSeconds: song.fadeInSeconds ?? PAD_DEFAULTS.fadeInSeconds,
      fadeOutSeconds: song.fadeOutSeconds ?? PAD_DEFAULTS.fadeOutSeconds,
      crossfadeSeconds: song.crossfadeSeconds ?? PAD_DEFAULTS.crossfadeSeconds,
    };
    // Song identity is the synchronization boundary; this does not run for
    // ordinary engine snapshots or slider renders.
    setPadSettings(next);
    if (audioStarted) {
      pads.engine.setMainVolume(muted ? 0 : next.mainVolume);
      pads.engine.setShimmerLevel(next.shimmer);
      pads.engine.setTone(next.tone);
      pads.engine.setBrightness(next.brightness);
      pads.engine.setWidth(next.width);
      pads.engine.setMotion(PAD_DEFAULTS.motion);
    }
  }, [activePadPresetId, audioStarted, availablePadPresets, muted, pads.engine, setActivePadPresetId, song]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      pads.engine.setMainVolume(next ? 0 : padSettings.mainVolume);
      return next;
    });
  }, [padSettings.mainVolume, pads.engine]);

  const setPadMuted = useCallback(
    (next: boolean) => {
      setMuted(next);
      pads.engine.setMainVolume(next ? 0 : padSettings.mainVolume);
    },
    [padSettings.mainVolume, pads.engine],
  );

  /** Everything audible starts from here, so it always follows a user gesture. */
  const startAudio = useCallback(async () => {
    await pads.preloadPreset();
    pads.engine.setMainVolume(muted ? 0 : padSettings.mainVolume);
    pads.engine.setShimmerLevel(padSettings.shimmer);
    pads.engine.setTone(padSettings.tone);
    pads.engine.setBrightness(padSettings.brightness);
    pads.engine.setWidth(padSettings.width);
    pads.engine.setMotion(PAD_DEFAULTS.motion);
    setAudioStarted(true);
  }, [muted, padSettings, pads]);

  // Any preset change — built in or freshly imported — decodes its keys, so a
  // key press after switching packs never waits on a decode.
  const preloadPreset = pads.preloadPreset;
  useEffect(() => {
    if (!audioStarted) return;
    void preloadPreset();
  }, [audioStarted, preloadPreset]);

  useEffect(() => {
    pads.engine.setTempo(
      padTempoBpm,
      song?.timeSignature.numerator ?? 4,
      song?.timeSignature.denominator ?? 4,
    );
  }, [padTempoBpm, pads.engine, song?.timeSignature.denominator, song?.timeSignature.numerator]);

  useEffect(() => {
    if (audioStarted) void preloadPreset();
  }, [audioStarted, padTempoTier, preloadPreset]);

  const fadeIn = useCallback(async () => {
    await startAudio();
    const result = await pads.engine.fadeIn(concertKey, { durationSeconds: padSettings.fadeInSeconds });
    if (!result.ok) return result;
    setTransition((current) => startPad(current, { tonic: concertKey, mode }));
    return result;
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

  const fadeInAtKey = useCallback(
    async (tonic: PitchClass, nextMode: Mode = mode) => {
      await startAudio();
      const result = await pads.engine.fadeIn(tonic, { durationSeconds: padSettings.fadeInSeconds });
      if (!result.ok) return result;
      setConcertKey(tonic, nextMode);
      setTransition((current) => startPad(current, { tonic, mode: nextMode }));
      return result;
    },
    [mode, padSettings.fadeInSeconds, pads.engine, setConcertKey, startAudio],
  );

  const runCrossfade = useCallback(
    async (tonic: PitchClass, nextMode: Mode) => {
      const startedAt = performance.now();
      setTransition((current) =>
        beginTransition(
          prepareTransition(current, { tonic, mode: nextMode }, startedAt),
          startedAt,
          padSettings.crossfadeSeconds,
        ),
      );
      const result = await pads.engine.crossfadeTo(tonic, padSettings.crossfadeSeconds);
      if (!result.ok) {
        setTransition((current) =>
          current.state === "transitioning"
            ? { ...current, state: "playing", target: null, armedAt: null, startedAt: null, durationSeconds: 0 }
            : current,
        );
        return result;
      }
      setTimeout(() => {
        // Only adopt the new key if the crossfade actually ran to the end; a
        // Stop now during the fade must not silently rewrite the song's key.
        if (transitionRef.current.state !== "transitioning") return;
        setConcertKey(tonic, nextMode);
        setTransition((current) => completeTransition(current));
      }, padSettings.crossfadeSeconds * 1000 + 120);
      return result;
    },
    [padSettings.crossfadeSeconds, pads.engine, setConcertKey],
  );

  const selectSongWithPadTransition = useCallback(
    async (target: Song): Promise<boolean> => {
      if (target.id === song?.id) return true;
      const targetTonic = target.concertKey as PitchClass;
      const padIsRunning = pads.engine.snapshot().state !== "stopped";
      const keyChanges = targetTonic !== concertKey;

      if (padIsRunning && keyChanges) {
        const startedAt = performance.now();
        // Resolve the incoming pad from the destination song's tempo without
        // replacing the outgoing voice first. This prevents two competing
        // crossfades when the songs belong to different slow-motion tiers.
        pads.engine.setTempo(
          target.bpm ?? DEFAULT_PAD_TEMPO_BPM,
          target.timeSignature.numerator,
          target.timeSignature.denominator,
          false,
        );
        setTransition((current) =>
          beginTransition(
            prepareTransition(current, { tonic: targetTonic, mode: target.mode }, startedAt),
            startedAt,
            padSettings.crossfadeSeconds,
          ),
        );
        const result = await pads.engine.crossfadeTo(targetTonic, padSettings.crossfadeSeconds);
        if (!result.ok) {
          pads.engine.setTempo(
            song?.bpm ?? DEFAULT_PAD_TEMPO_BPM,
            song?.timeSignature.numerator ?? 4,
            song?.timeSignature.denominator ?? 4,
            false,
          );
          setTransition((current) =>
            current.state === "transitioning"
              ? { ...current, state: "playing", target: null, armedAt: null, startedAt: null, durationSeconds: 0 }
              : current,
          );
          return false;
        }
        setTimeout(() => {
          if (transitionRef.current.state === "transitioning") {
            setTransition((current) => completeTransition(current));
          }
        }, padSettings.crossfadeSeconds * 1000 + 120);
      }

      setSetlist((current) => selectSong(current, target.id));
      return true;
    },
    [concertKey, padSettings.crossfadeSeconds, pads.engine, song],
  );

  const prepareKey = useCallback(
    (tonic: PitchClass, nextMode: Mode = mode) => {
      setTransition((current) => prepareTransition(current, { tonic, mode: nextMode }, performance.now()));
    },
    [mode],
  );

  /** A running pad moves immediately with an equal-power crossfade. */
  const onKeySelected = useCallback(
    (tonic: PitchClass) => {
      if (transition.state === "stopped") {
        void fadeInAtKey(tonic, mode);
        return;
      }
      if (tonic === concertKey) return;
      void runCrossfade(tonic, mode);
    },
    [concertKey, fadeInAtKey, mode, runCrossfade, transition.state],
  );

  const switchNow = useCallback(async () => {
    const target = transitionRef.current.target;
    if (!target) return { ok: false as const, reason: "No key is prepared." };
    return runCrossfade(target.tonic, target.mode);
  }, [runCrossfade]);

  const rampSpatialControls = useCallback(
    (targetBrightness: number, targetWidth: number, durationSeconds: number) => {
      if (spatialRampTimerRef.current) clearInterval(spatialRampTimerRef.current);
      const fromBrightness = padSettingsRef.current.brightness;
      const fromWidth = padSettingsRef.current.width;
      const durationMs = Math.max(50, durationSeconds * 1000);
      const startedAt = performance.now();

      // Schedule the actual DSP only once. The modest UI timer below merely
      // mirrors progress and never reschedules audio automation.
      pads.engine.rampBrightness(targetBrightness, durationSeconds);
      pads.engine.rampWidth(targetWidth, durationSeconds);
      spatialRampTimerRef.current = setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
        const patch = {
          brightness: Math.round(fromBrightness + (targetBrightness - fromBrightness) * progress),
          width: Math.round(fromWidth + (targetWidth - fromWidth) * progress),
        };
        padSettingsRef.current = { ...padSettingsRef.current, ...patch };
        setPadSettings((current) => ({ ...current, ...patch }));
        if (progress >= 1 && spatialRampTimerRef.current) {
          clearInterval(spatialRampTimerRef.current);
          spatialRampTimerRef.current = null;
        }
      }, 100);
    },
    [pads.engine],
  );

  const releaseCrescendo = useCallback(() => {
    const releaseSeconds = 4;
    const returnPoint = crescendoReturnPointRef.current ?? {
      brightness: PAD_DEFAULTS.brightness,
      width: PAD_DEFAULTS.width,
    };
    pads.engine.cancelCrescendo(releaseSeconds);
    rampSpatialControls(returnPoint.brightness, returnPoint.width, releaseSeconds);
    crescendoReturnPointRef.current = null;
    setTransition((current) => cancelPreparation(current));
  }, [pads.engine, rampSpatialControls]);

  const cancelTransition = useCallback(() => {
    if (transitionRef.current.state === "crescendo") {
      releaseCrescendo();
      return;
    }
    setTransition((current) => cancelPreparation(current));
  }, [releaseCrescendo]);

  const runCrescendo = useCallback(() => {
    if (transitionRef.current.state === "crescendo") {
      releaseCrescendo();
      return;
    }
    crescendoReturnPointRef.current = {
      brightness: padSettingsRef.current.brightness,
      width: padSettingsRef.current.width,
    };
    pads.engine.startCrescendo(padSettings.crescendoSeconds);
    rampSpatialControls(100, 100, padSettings.crescendoSeconds);
    setTransition((current) => startCrescendo(current, performance.now(), padSettings.crescendoSeconds));
  }, [padSettings.crescendoSeconds, pads.engine, rampSpatialControls, releaseCrescendo]);

  /* ------------------------------------------------------ chord detection */

  const soundingNotes = useMemo(
    () => midi.notes.sounding.map((note) => adjustMidiNote(note, transposeForDevice(preferences, midi.selectedInput?.id))),
    [midi.notes.sounding, midi.selectedInput?.id, preferences],
  );
  const bassMidiNote = soundingNotes[0] ?? null;

  const [chord, setChord] = useState<ReturnType<ChordStabilizer["update"]>>(null);

  useEffect(() => {
    const now = performance.now();
    setChord(
      stabilizerRef.current.update(soundingNotes, now, {
        bassMidiNote,
        keyTonic: concertKey,
        keyMode: mode,
      }),
    );
  }, [soundingNotes, bassMidiNote, concertKey, mode]);

  // The stage number follows the lowest sounding register, not the full chord
  // analysis. High melody notes therefore cannot replace the bass foundation.
  const nashvilleBassNumber =
    bassMidiNote != null ? simpleBassNumberForMidiNote(bassMidiNote, concertKey) : null;
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
  const [outputDeviceId, setOutputDeviceId] = useState("");
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
          void switchNow();
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
          if (target) void selectSongWithPadTransition(target);
          break;
        }
      }
    },
    [cancelTransition, prepareKey, runCrescendo, selectSongWithPadTransition, setlist, stopNow, switchNow],
  );

  const voice = useVoice({
    language: preferences.voiceLanguage,
    requireWakeWord: preferences.requireWakeWord,
    onCommand: handleVoiceCommand,
  });
  const handledCountdownIdRef = useRef<string | null>(null);
  const latestVoiceSegment = voice.segments.at(-1);
  const recentVoiceTranscript = voice.segments
    .slice(-3)
    .map((segment) => segment.text)
    .join(" ");
  useEffect(() => {
    if (!latestVoiceSegment || latestVoiceSegment.id === handledCountdownIdRef.current) return;
    handledCountdownIdRef.current = latestVoiceSegment.id;
    // Browsers differ here: some deliver "3 2 1" as one final result, others
    // finalize each spoken number separately. The three-segment window handles
    // both without accepting an incomplete countdown.
    if (transitionRef.current.state !== "crescendo" || !isSpokenCountdown(recentVoiceTranscript)) return;
    releaseCrescendo();
  }, [latestVoiceSegment, recentVoiceTranscript, releaseCrescendo]);

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
    async (command: LeaderCommand): Promise<{ applied: boolean; reason?: string }> => {
      switch (command.type) {
        case "select-song": {
          const target = setlist.songs.find((entry) => entry.id === command.songId);
          if (!target) return { applied: false, reason: "Unknown song." };
          return (await selectSongWithPadTransition(target))
            ? { applied: true }
            : { applied: false, reason: "The next song pad could not be started." };
        }
        case "next-song":
        case "previous-song": {
          const target = neighbourSong(setlist, command.type === "next-song" ? 1 : -1);
          if (!target) return { applied: false, reason: "End of the setlist." };
          return (await selectSongWithPadTransition(target))
            ? { applied: true }
            : { applied: false, reason: "The next song pad could not be started." };
        }
        case "set-bpm":
          if (!song) return { applied: false, reason: "No song is selected." };
          setSetlist((current) => updateSong(current, song.id, { bpm: command.bpm }));
          return { applied: true };
        case "add-song":
          setSetlist((current) => addSong(current, command.song));
          return { applied: true };
        case "update-song":
          if (!setlist.songs.some((entry) => entry.id === command.song.id)) {
            return { applied: false, reason: "Unknown song." };
          }
          setSetlist((current) => updateSong(current, command.song.id, command.song));
          return { applied: true };
        case "remove-song":
          if (!setlist.songs.some((entry) => entry.id === command.songId)) {
            return { applied: false, reason: "Unknown song." };
          }
          setSetlist((current) => removeSong(current, command.songId));
          return { applied: true };
        case "duplicate-song":
          if (!setlist.songs.some((entry) => entry.id === command.songId)) {
            return { applied: false, reason: "Unknown song." };
          }
          setSetlist((current) => duplicateSong(current, command.songId));
          return { applied: true };
        case "rename-setlist":
          setSetlist((current) => ({ ...current, name: command.name }));
          return { applied: true };
        case "replace-setlist":
          setSetlist(command.setlist);
          return { applied: true };
        case "set-key":
          if (transitionRef.current.state === "stopped") {
            const result = await fadeInAtKey(command.tonic as PitchClass, command.mode);
            return result.ok ? { applied: true } : { applied: false, reason: result.reason };
          }
          return (await runCrossfade(command.tonic as PitchClass, command.mode)).ok
            ? { applied: true }
            : { applied: false, reason: "The target pad could not be started." };
        case "prepare":
          prepareKey(command.tonic as PitchClass, command.mode);
          return { applied: true };
        case "cancel-preparation":
          cancelTransition();
          return { applied: true };
        case "switch-now":
          if (!transitionRef.current.target) return { applied: false, reason: "No key is prepared." };
          return (await switchNow()).ok ? { applied: true } : { applied: false, reason: "The target pad could not be started." };
        case "crescendo":
          runCrescendo();
          return { applied: true };
        case "fade-in":
          {
            const result = await fadeIn();
            return result.ok ? { applied: true } : { applied: false, reason: result.reason };
          }
        case "fade-out":
          fadeOut();
          return { applied: true };
        case "stop-pads":
          stopNow();
          return { applied: true };
        case "set-pad-settings":
          applyPadSettings(command.patch);
          return { applied: true };
        case "set-muted":
          setPadMuted(command.muted);
          return { applied: true };
      }
    },
    [applyPadSettings, cancelTransition, fadeIn, fadeInAtKey, fadeOut, prepareKey, runCrescendo, runCrossfade, selectSongWithPadTransition, setlist, setPadMuted, song, stopNow, switchNow],
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
      void applyLeaderCommandRef.current(command).then((result) => acknowledge(messageId, result.applied, result.reason));
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
      setlist,
      concertKey: spellKey(concertKey, mode, preferences.notation),
      mode,
      timeSignature: song ? formatTimeSignature(song.timeSignature) : "4/4",
      bpm: song?.bpm,
      detectedChord: chordLabel ?? undefined,
      nashville: nashvilleBassNumber ?? undefined,
      chordConfidence: chord?.candidate.confidence,
      midiPressed: midi.notes.pressed,
      midiSustained: midi.notes.sustained,
      midiDeviceName: midi.selectedInput?.name,
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
      padSettings,
      muted,
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
    midi.notes.pressed,
    midi.notes.sustained,
    midi.selectedInput?.name,
    nashvilleBassNumber,
    pads.snapshot?.state,
    padSettings,
    muted,
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
          if (next) void selectSongWithPadTransition(next);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelTransition, concertKey, fadeIn, fadeOut, prepareKey, selectSongWithPadTransition, setlist, switchNow, voice, voiceDeviceId]);

  /* ------------------------------------------------------------- rendering */

  const position = songPosition(setlist, song?.id);
  const previousSong = neighbourSong(setlist, -1);
  const nextSong = neighbourSong(setlist, 1);
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
        nashvilleText={nashvilleBassNumber}
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
          onSelect={(songId) => {
            const target = setlist.songs.find((entry) => entry.id === songId);
            if (target) void selectSongWithPadTransition(target);
          }}
          onAddSong={() => setEditingSong({ song: createSong({ padPresetId: pads.presetId }), isNew: true })}
          onEditSong={(songId) => {
            const found = setlist.songs.find((entry) => entry.id === songId);
            if (found) setEditingSong({ song: found, isNew: false });
          }}
          onRename={(name) => setSetlist((current) => ({ ...current, name }))}
          unsaved={unsaved}
        />
        <div className="rail-foot">
          <SetlistTransfer
            state={createPersistedState(setlist, preferences)}
            onImport={(state) => {
              setSetlist(state.setlist);
              setPreferences(state.preferences);
            }}
            onNotice={setStorageNotice}
          />
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
            <OpenDriveSetlistButton
              onImport={(state) => {
                setSetlist(state.setlist);
                setPreferences(state.preferences);
              }}
              onNotice={setStorageNotice}
            />
            <button
              type="button"
              className="btn tone-quiet"
              disabled={!previousSong}
              onClick={() => previousSong && void selectSongWithPadTransition(previousSong)}
            >
              ← Previous song
            </button>
            <button
              type="button"
              className="btn tone-quiet"
              disabled={!nextSong}
              onClick={() => nextSong && void selectSongWithPadTransition(nextSong)}
            >
              Next song →
            </button>
            <button
              type="button"
              className="btn tone-quiet"
              disabled={!song}
              onClick={() => song && setEditingSong({ song, isNew: false })}
            >
              Edit song
            </button>
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
            bassNumber={nashvilleBassNumber}
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
              disabled={transition.state === "transitioning"}
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
            crescendoActive={pads.snapshot?.crescendoActive ?? false}
            onFadeIn={() => void fadeIn()}
            onFadeOut={fadeOut}
            onStopNow={stopNow}
            onCrescendo={runCrescendo}
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
          mode={mode}
          onPresetChange={(id) => {
            pads.setPresetId(id);
            if (song) setSetlist((current) => updateSong(current, song.id, { padPresetId: id }));
          }}
          settings={padSettings}
          onChange={applyPadSettings}
          muted={muted}
          onToggleMute={toggleMute}
          shimmerMode={pads.snapshot?.shimmerMode ?? "reverb-only"}
          bpm={padTempoBpm}
          onBpmChange={(bpm) => {
            if (song) setSetlist((current) => updateSong(current, song.id, { bpm }));
          }}
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
          outputDevices={devices.outputs}
          outputDeviceId={outputDeviceId}
          canChooseOutput={outputSupport.canChooseOutput}
          outputHelp={outputSupport.reason}
          onChooseOutput={() => {
            void chooseOutputDevice().then((device) => {
              if (device) {
                setOutputDeviceId(device.deviceId);
                void startAudio().then(() => pads.engine.setOutputDevice(device.deviceId, device.label));
              }
              refreshDevices();
            });
          }}
          onSelectOutput={(device) => {
            if (!device) {
              setOutputDeviceId("");
              void pads.engine.resetOutputToSystemDefault();
              return;
            }
            setOutputDeviceId(device.deviceId);
            void startAudio().then(() => pads.engine.setOutputDevice(device.deviceId, device.label));
          }}
          onResetOutput={() => {
            setOutputDeviceId("");
            void pads.engine.resetOutputToSystemDefault();
          }}
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
          joinsLocked={session.snapshot?.joinsLocked ?? false}
          onToggleRemoteLock={() =>
            session.sendHostCommand({ type: "set-remote-lock", locked: !(session.snapshot?.remoteControlLocked ?? false) })
          }
          onToggleJoinsLock={() =>
            session.sendHostCommand({ type: "lock-new-joins", locked: !(session.snapshot?.joinsLocked ?? false) })
          }
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
            Off by default: only the tonic of a voice-prepared key triggers it. Clicking a key always transitions immediately.
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
          <Status tone="info" state="Shortcuts" detail="Space fade · C crescendo · Esc cancel · L exit" />
        </div>
      </div>
    </div>
  );
}
