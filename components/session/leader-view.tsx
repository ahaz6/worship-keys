"use client";

import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Modal } from "@/components/common/modal";
import { SliderField } from "@/components/common/slider-field";
import { Status } from "@/components/common/status";
import { KeyboardStrip } from "@/components/midi/keyboard-strip";
import { DEFAULT_PAD_TEMPO_BPM, PAD_DEFAULTS } from "@/components/pads/pad-controls";
import { BrightnessWidthPad, XyPad } from "@/components/pads/xy-pad";
import { KeyRibbon } from "@/components/performance/key-ribbon";
import { SetlistRail } from "@/components/setlist/setlist-rail";
import { SetlistTransfer } from "@/components/setlist/setlist-transfer";
import { SongDialog } from "@/components/setlist/song-dialog";
import { PAD_LIMITS } from "@/lib/audio/pad-engine";
import { spellKeyShort, spellPitchClassBoth } from "@/lib/music/notation";
import { PITCH_CLASSES, type Mode, type PitchClass } from "@/lib/music/pitch";
import type { LeaderCommand, LivePadSettings, LiveSessionSnapshot } from "@/lib/session/protocol";
import { createSong } from "@/lib/storage/setlist-operations";
import { createPersistedState } from "@/lib/storage/setlist-repository";
import type { Setlist, Song } from "@/lib/storage/schema";
import type { PadPreset } from "@/types/pads";

const REMOTE_PAD_PRESETS: readonly PadPreset[] = [
  {
    id: "sound-walls",
    name: "Sound Wall Pads",
    description: "Warm worship pad for major and minor songs.",
    mode: "neutral",
    keys: [],
  },
];

/**
 * Pianist iPad (spec 18.2).
 *
 * Musical controls only. Devices, channels, sample rates and anything that
 * could break the hardware connection stay on the host. Nothing here shows as
 * done until the host has acknowledged it.
 */
export function LeaderView({
  snapshot,
  stale,
  ageSeconds,
  pendingCommand,
  lastMessage,
  onDismissMessage,
  onCommand,
}: {
  snapshot: LiveSessionSnapshot | null;
  stale: boolean;
  ageSeconds: number;
  pendingCommand: boolean;
  lastMessage: string | null;
  onDismissMessage: () => void;
  onCommand: (command: LeaderCommand) => void;
}) {
  const locked = snapshot?.remoteControlLocked ?? false;
  const playing = snapshot?.padState !== "stopped";
  const fadingIn = snapshot?.padState === "fading-in";
  const fadingOut = snapshot?.padState === "fading-out";
  const automationProgress = Math.round((snapshot?.padProgress ?? 0) * 100);
  // Every key is offered: the host holds the pads and knows what is decoded.
  const allKeys = new Set<PitchClass>(PITCH_CLASSES);
  const mode: Mode = snapshot?.mode ?? "major";
  const preparedTonic = snapshot?.preparedKey ? keyTonicFrom(snapshot.preparedKey) : null;
  const [setlistOpen, setSetlistOpen] = useState(false);
  const activeSongIndex = snapshot?.setlist?.songs.findIndex((song) => song.id === snapshot.activeSong?.id) ?? -1;
  const previousSong = activeSongIndex > 0 ? snapshot?.setlist?.songs[activeSongIndex - 1] : undefined;
  const nextSong =
    activeSongIndex >= 0 && activeSongIndex < (snapshot?.setlist?.songs.length ?? 0) - 1
      ? snapshot?.setlist?.songs[activeSongIndex + 1]
      : undefined;
  const visibleMessage = lastMessage === "The host granted leader access." ? null : lastMessage;

  return (
    <div className="live-shell">
      <div className="live-top leader-live-top">
        <BrandMark size={38} />
        <div className="leader-top-transport" aria-label="Pad transport">
          <button
            type="button"
            className={`transport-btn leader-top-transport-button${fadingIn ? " is-running" : ""}`}
            disabled={locked || pendingCommand}
            onClick={() => onCommand({ type: "fade-in" })}
            aria-label={fadingIn ? "Fading in" : "Fade in"}
          >
            {fadingIn ? <span className="progress" style={{ width: `${automationProgress}%` }} /> : null}
            <span className="arrow" aria-hidden="true">▲</span>
            {fadingIn ? "Fading in" : "Fade in"}
          </button>
          <button
            type="button"
            className={`transport-btn leader-top-transport-button${fadingOut ? " is-running" : ""}`}
            disabled={locked || pendingCommand || !playing}
            onClick={() => onCommand({ type: "fade-out" })}
            aria-label={fadingOut ? "Fading out" : "Fade out"}
          >
            {fadingOut ? <span className="progress" style={{ width: `${automationProgress}%` }} /> : null}
            <span className="arrow" aria-hidden="true">▼</span>
            {fadingOut ? "Fading out" : "Fade out"}
          </button>
          <button
            type="button"
            className={`transport-btn leader-top-transport-button${snapshot?.crescendoActive ? " is-running" : ""}`}
            disabled={locked || pendingCommand || !playing}
            onClick={() => onCommand({ type: "crescendo" })}
          >
            {snapshot?.crescendoActive ? "Release Crescendo" : "Crescendo"}
          </button>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={locked || !snapshot?.setlist}
            onClick={() => setSetlistOpen(true)}
          >
            Setlist
          </button>
          <span className={`role-chip ${stale ? "tone-stale" : "tone-live"}`}>
            {stale ? "LEADER · RECONNECTING" : "LEADER · LIVE"}
          </span>
        </div>
      </div>

      {locked ? <div className="callout tone-warn">Remote control is locked by the host.</div> : null}
      {visibleMessage ? (
        <div className="callout">
          <span>{visibleMessage}</span>
          <span className="callout-actions">
            <button type="button" className="btn tone-quiet" onClick={onDismissMessage} aria-label="Dismiss message">
              ×
            </button>
          </span>
        </div>
      ) : null}

      <div className="live-main" style={{ gap: 8 }}>
        <span className="label">
          {snapshot?.activeSong
            ? `${snapshot.activeSong.title} · Song ${snapshot.activeSong.position} of ${snapshot.activeSong.total}`
            : "No song selected"}
        </span>
        <div className={`live-nashville${snapshot?.nashville ? "" : " is-idle"}`} style={{ fontSize: "clamp(90px, 18vw, 180px)" }}>
          {snapshot?.nashville ?? "—"}
        </div>
        <div className="leader-now-row">
          <div className={`leader-song-nav is-previous${previousSong ? "" : " is-empty"}`}>
            <button
              type="button"
              className="leader-song-arrow"
              aria-label={previousSong ? `Previous song: ${previousSong.title}` : "Previous song"}
              disabled={locked || pendingCommand || snapshot?.transitionState === "transitioning" || !previousSong}
              onClick={() => onCommand({ type: "previous-song" })}
            >
              ←
            </button>
            <span className="leader-song-name">
              <small>Previous song</small>
              <strong>{previousSong?.title ?? "Start of setlist"}</strong>
              {previousSong ? (
                <em>in Key of {spellKeyShort(previousSong.concertKey as PitchClass, previousSong.mode)}</em>
              ) : null}
            </span>
          </div>
          <div className="live-chord" style={{ fontSize: "clamp(24px, 5vw, 46px)" }}>
            {snapshot?.detectedChord ?? "Listening"}
          </div>
          <div className={`leader-song-nav is-next${nextSong ? "" : " is-empty"}`}>
            <span className="leader-song-name">
              <small>Next song</small>
              <strong>{nextSong?.title ?? "End of setlist"}</strong>
              {nextSong ? (
                <em>in Key of {spellKeyShort(nextSong.concertKey as PitchClass, nextSong.mode)}</em>
              ) : null}
            </span>
            <button
              type="button"
              className="leader-song-arrow"
              aria-label={nextSong ? `Next song: ${nextSong.title}` : "Next song"}
              disabled={locked || pendingCommand || snapshot?.transitionState === "transitioning" || !nextSong}
              onClick={() => onCommand({ type: "next-song" })}
            >
              →
            </button>
          </div>
        </div>
        <div className="live-key">
          {snapshot ? `${snapshot.concertKey} · ${snapshot.timeSignature}` : ""}
        </div>
        {snapshot?.preparedKey ? (
          <div className={`live-prepared${snapshot.crossfading ? " is-running" : ""}`}>
            {snapshot.crossfading ? (
              <span className="leader-transition-progress" style={{ width: `${automationProgress}%` }} />
            ) : null}
            <span className="leader-transition-copy">
              Prepared: {snapshot.preparedKey}
              {snapshot.crossfading ? ` · Crossfading ${automationProgress}%` : ""}
            </span>
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <div className="section-title">
            <span>Concert key · tap to transition</span>
            <span>{mode === "major" ? "Major" : "Minor"}</span>
          </div>
          <KeyRibbon
            currentKey={snapshot ? keyTonicFrom(snapshot.concertKey) : null}
            preparedKey={preparedTonic}
            mode={mode}
            readyKeys={allKeys}
            disabled={locked || snapshot?.transitionState === "transitioning"}
            onSelect={(tonic) => onCommand({ type: "set-key", tonic, mode })}
          />
          <p className="hint" style={{ marginTop: 8 }}>
            A new key starts a smooth {snapshot?.padSettings.crossfadeSeconds ?? 4}-second transition on the host immediately.
          </p>
        </div>

        {snapshot ? (
          <div className="leader-keyboard-layer">
            <div className="section-title">
              <span>Keyboard layer</span>
              <span>{snapshot.midiPressed.length + snapshot.midiSustained.length} active</span>
            </div>
            <KeyboardStrip
              pressed={snapshot.midiPressed}
              sustained={snapshot.midiSustained}
              deviceName={snapshot.midiDeviceName ?? null}
            />
          </div>
        ) : null}

        {snapshot ? (
          <LeaderPadControls snapshot={snapshot} locked={locked} onCommand={onCommand} />
        ) : null}

        <div className="dock-actions">
          <button type="button" className="transport-btn tone-stop" disabled={locked || pendingCommand} onClick={() => onCommand({ type: "stop-pads" })}>
            Stop now
          </button>
        </div>

        <div className="status-line">
          <Status tone={snapshot?.hostOnline ? "ok" : "warn"} state={snapshot?.hostOnline ? "Host online" : "Host offline"} />
          <Status tone={stale ? "warn" : "info"} state={stale ? "Reconnecting" : "Updated"} detail={stale ? `${ageSeconds}s ago` : "now"} />
          <Status tone={pendingCommand ? "active" : "idle"} state={pendingCommand ? "Waiting for host" : "Ready"} />
        </div>
      </div>

      {setlistOpen && snapshot?.setlist ? (
        <LeaderSetlistManager
          setlist={snapshot.setlist}
          pendingCommand={pendingCommand}
          onCommand={onCommand}
          onClose={() => setSetlistOpen(false)}
        />
      ) : null}
    </div>
  );
}

function LeaderSetlistManager({
  setlist,
  pendingCommand,
  onCommand,
  onClose,
}: {
  setlist: Setlist;
  pendingCommand: boolean;
  onCommand: (command: LeaderCommand) => void;
  onClose: () => void;
}) {
  const [editingSong, setEditingSong] = useState<{ song: Song; isNew: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(setlist.name);
  const renameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (renameTimer.current) clearTimeout(renameTimer.current);
    },
    [],
  );

  const rename = (name: string) => {
    setDraftName(name);
    if (renameTimer.current) clearTimeout(renameTimer.current);
    const trimmed = name.trim();
    if (!trimmed) return;
    renameTimer.current = setTimeout(() => onCommand({ type: "rename-setlist", name: trimmed }), 300);
  };

  return (
    <>
      <Modal title="Setlist · Host" onClose={onClose} wide>
        <div className="leader-setlist-manager">
          <SetlistRail
            setlist={{ ...setlist, name: draftName }}
            activeSongId={setlist.activeSongId}
            onSelect={(songId) => onCommand({ type: "select-song", songId })}
            onAddSong={() =>
              setEditingSong({ song: createSong({ padPresetId: "sound-walls" }), isNew: true })
            }
            onEditSong={(songId) => {
              const found = setlist.songs.find((entry) => entry.id === songId);
              if (found) setEditingSong({ song: found, isNew: false });
            }}
            onRename={rename}
            unsaved={pendingCommand}
            showEditButtons
          />
          <SetlistTransfer
            state={createPersistedState(setlist)}
            onImport={(state) => onCommand({ type: "replace-setlist", setlist: state.setlist })}
            onNotice={setNotice}
          />
          <p className="hint">Tap a song to select it. Double-tap it to edit key, tempo and details.</p>
          {notice ? (
            <div className="callout">
              <span>{notice}</span>
              <button type="button" className="btn tone-quiet" onClick={() => setNotice(null)} aria-label="Dismiss notice">
                ×
              </button>
            </div>
          ) : null}
        </div>
      </Modal>

      {editingSong ? (
        <SongDialog
          song={editingSong.song}
          presets={REMOTE_PAD_PRESETS}
          isNew={editingSong.isNew}
          onSave={(nextSong) => {
            onCommand({ type: editingSong.isNew ? "add-song" : "update-song", song: nextSong });
            setEditingSong(null);
          }}
          onDelete={() => {
            onCommand({ type: "remove-song", songId: editingSong.song.id });
            setEditingSong(null);
          }}
          onDuplicate={() => {
            onCommand({ type: "duplicate-song", songId: editingSong.song.id });
            setEditingSong(null);
          }}
          onClose={() => setEditingSong(null)}
        />
      ) : null}
    </>
  );
}

function LeaderPadControls({
  snapshot,
  locked,
  onCommand,
}: {
  snapshot: LiveSessionSnapshot;
  locked: boolean;
  onCommand: (command: LeaderCommand) => void;
}) {
  const [settings, setSettings] = useState(snapshot.padSettings);
  const [bpm, setBpm] = useState(snapshot.bpm ?? DEFAULT_PAD_TEMPO_BPM);
  const queuedPatch = useRef<Partial<LivePadSettings>>({});
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tempoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedBpm = useRef(bpm);
  const desiredPatch = useRef<Partial<LivePadSettings>>({});
  const desiredBpm = useRef<{ value: number | null; changedAt: number }>({ value: null, changedAt: 0 });

  useEffect(() => {
    const pending = desiredPatch.current;
    const pendingEntries = Object.entries(pending) as Array<
      [keyof LivePadSettings, LivePadSettings[keyof LivePadSettings]]
    >;
    const stillPending = Object.fromEntries(
      pendingEntries.filter(([key, value]) => snapshot.padSettings[key] !== value),
    ) as Partial<LivePadSettings>;
    // Keep each local value until the host snapshot contains that exact value.
    // A fixed timeout caused unrelated slider packets to expose an older host
    // XY value and made the Brightness/Width handle visibly jump.
    desiredPatch.current = stillPending;
    setSettings({ ...snapshot.padSettings, ...stillPending });
  }, [snapshot.padSettings]);

  useEffect(() => {
    const hostBpm = snapshot.bpm ?? DEFAULT_PAD_TEMPO_BPM;
    const desired = desiredBpm.current;
    if (desired.value === hostBpm || Date.now() - desired.changedAt > 2_000) {
      desiredBpm.current = { value: null, changedAt: 0 };
      setBpm(hostBpm);
      return;
    }
    if (desired.value != null) setBpm(desired.value);
  }, [snapshot.bpm]);

  useEffect(
    () => () => {
      if (sendTimer.current) clearTimeout(sendTimer.current);
      if (tempoTimer.current) clearTimeout(tempoTimer.current);
    },
    [],
  );

  const change = (patch: Partial<LivePadSettings>) => {
    desiredPatch.current = { ...desiredPatch.current, ...patch };
    setSettings((current) => ({ ...current, ...patch }));
    queuedPatch.current = { ...queuedPatch.current, ...patch };
    if (sendTimer.current) return;
    sendTimer.current = setTimeout(() => {
      const next = queuedPatch.current;
      queuedPatch.current = {};
      sendTimer.current = null;
      onCommand({ type: "set-pad-settings", patch: next });
    }, 40);
  };

  const changeTempo = (nextBpm: number) => {
    desiredBpm.current = { value: nextBpm, changedAt: Date.now() };
    setBpm(nextBpm);
    queuedBpm.current = nextBpm;
    if (tempoTimer.current) return;
    tempoTimer.current = setTimeout(() => {
      tempoTimer.current = null;
      onCommand({ type: "set-bpm", bpm: queuedBpm.current });
    }, 60);
  };

  return (
    <section className="leader-pad-controls" aria-label="Live pad sound controls">
      <div className="section-title" style={{ padding: 0 }}>
        <span>Sound Wall Pads · live</span>
        <span>Host output</span>
      </div>
      <div className="leader-sound-layout">
        <XyPad
          tone={settings.tone}
          shimmer={settings.shimmer}
          onChange={(next) => {
            if (!locked) change(next);
          }}
          defaults={{ tone: PAD_DEFAULTS.tone, shimmer: PAD_DEFAULTS.shimmer }}
          disabled={locked}
        />
        <div className="leader-vertical-controls">
          <LeaderVerticalSlider
            label="Main Volume"
            value={settings.mainVolume}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => change({ mainVolume: value })}
            disabled={locked}
          />
          <LeaderVerticalSlider
            label="Song Tempo"
            value={bpm}
            min={40}
            max={180}
            unit=" BPM"
            onChange={changeTempo}
            disabled={locked}
            tone="blue"
          />
        </div>
        <BrightnessWidthPad
          brightness={settings.brightness}
          width={settings.width}
          onChange={(next) => {
            if (!locked) change(next);
          }}
          defaults={{ brightness: PAD_DEFAULTS.brightness, width: PAD_DEFAULTS.width }}
          disabled={locked}
        />
      </div>
      <div className="leader-pad-quick-actions">
        <button
          type="button"
          className={`btn${snapshot.muted ? " is-active" : ""}`}
          disabled={locked}
          onClick={() => onCommand({ type: "set-muted", muted: !snapshot.muted })}
        >
          {snapshot.muted ? "Unmute host output" : "Mute host output"}
        </button>
        <button
          type="button"
          className="btn tone-quiet"
          disabled={locked || settings.mainVolume === PAD_DEFAULTS.mainVolume}
          onClick={() => change({ mainVolume: PAD_DEFAULTS.mainVolume })}
        >
          Reset volume to {PAD_DEFAULTS.mainVolume}%
        </button>
        <button
          type="button"
          className="btn tone-quiet"
          disabled={locked || bpm === DEFAULT_PAD_TEMPO_BPM}
          onClick={() => changeTempo(DEFAULT_PAD_TEMPO_BPM)}
        >
          Reset tempo to {DEFAULT_PAD_TEMPO_BPM} BPM
        </button>
      </div>
      <div className="leader-timing-controls" aria-label="Pad transition timing">
        <SliderField
          label="Fade in"
          value={settings.fadeInSeconds}
          min={PAD_LIMITS.fadeSeconds.min}
          max={PAD_LIMITS.fadeSeconds.max}
          step={0.5}
          unit="s"
          onChange={(value) => change({ fadeInSeconds: value })}
          disabled={locked}
        />
        <SliderField
          label="Fade out"
          value={settings.fadeOutSeconds}
          min={PAD_LIMITS.fadeSeconds.min}
          max={PAD_LIMITS.fadeSeconds.max}
          step={0.5}
          unit="s"
          onChange={(value) => change({ fadeOutSeconds: value })}
          disabled={locked}
        />
        <SliderField
          label="Crossfade"
          value={settings.crossfadeSeconds}
          min={PAD_LIMITS.crossfadeSeconds.min}
          max={PAD_LIMITS.crossfadeSeconds.max}
          step={0.5}
          unit="s"
          tone="blue"
          onChange={(value) => change({ crossfadeSeconds: value })}
          disabled={locked}
        />
        <SliderField
          label="Crescendo"
          value={settings.crescendoSeconds}
          min={PAD_LIMITS.crescendoSeconds.min}
          max={PAD_LIMITS.crescendoSeconds.max}
          step={1}
          unit="s"
          tone="blue"
          onChange={(value) => change({ crescendoSeconds: value })}
          disabled={locked}
        />
      </div>
    </section>
  );
}

function LeaderVerticalSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  disabled,
  tone = "main",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
  disabled: boolean;
  tone?: "main" | "blue";
}) {
  return (
    <label className="leader-vertical-field">
      <span>{label}</span>
      <strong className="mono">{value}{unit}</strong>
      <input
        type="range"
        className={`leader-vertical-slider tone-${tone}`}
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small>{max}{unit}</small>
      <small>{min}{unit}</small>
    </label>
  );
}

/** Reads the tonic back out of a "G Major" style label from the snapshot. */
function keyTonicFrom(label: string): PitchClass {
  const name = label.split(" ")[0] ?? "C";
  const index = PITCH_CLASSES.find((pitchClass) => spellPitchClassBoth(pitchClass).split("/").includes(name));
  return index ?? 0;
}
