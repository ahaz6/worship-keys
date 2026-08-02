"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PadAssetLoader } from "@/lib/audio/asset-loader";
import { PAD_LIMITS, PadEngine, type PadEngineSnapshot } from "@/lib/audio/pad-engine";
import type { PitchClass } from "@/lib/music/pitch";
import type { PadManifest, PadPreset } from "@/types/pads";

export type EngineError = { code: string; message: string };

/**
 * Owns the single long-lived PadEngine for the page.
 *
 * The engine is created lazily on the first user gesture, because an
 * AudioContext started without one is suspended and silent.
 */
export function usePadEngine() {
  const [snapshot, setSnapshot] = useState<PadEngineSnapshot | null>(null);
  const [manifest, setManifest] = useState<PadManifest | null>(null);
  const [presetId, setPresetId] = useState<string>("aurora");
  // Kept per preset id so switching preset does not need a reset effect.
  const [readyByPreset, setReadyByPreset] = useState<Record<string, PitchClass[]>>({});
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [error, setError] = useState<EngineError | null>(null);
  const [meter, setMeter] = useState({ left: 0, right: 0 });
  // Locally imported packs live only in this browser session (spec 8.10).
  const [localPresets, setLocalPresets] = useState<PadPreset[]>([]);

  // One engine per page, created lazily so the AudioContext is only built once.
  const [engine] = useState(() => new PadEngine({ onSnapshot: setSnapshot, onError: setError }));

  // Manifest first: the key ribbon needs to know which keys exist before audio
  // is ever started.
  useEffect(() => {
    const controller = new AbortController();
    PadAssetLoader.loadManifest(controller.signal)
      .then(setManifest)
      .catch((issue: unknown) => {
        if (controller.signal.aborted) return;
        setError({
          code: "manifest",
          message: issue instanceof Error ? issue.message : "The pad packs could not be listed.",
        });
      });
    return () => controller.abort();
  }, []);

  const presets: PadPreset[] = useMemo(
    () => [...(manifest?.presets ?? []), ...localPresets],
    [manifest, localPresets],
  );

  const preset: PadPreset | null = useMemo(
    () => presets.find((entry) => entry.id === presetId) ?? presets[0] ?? null,
    [presets, presetId],
  );

  useEffect(() => {
    if (preset) engine.setPreset(preset);
  }, [engine, preset]);

  const readyKeys = useMemo(() => new Set(preset ? (readyByPreset[preset.id] ?? []) : []), [preset, readyByPreset]);

  /** Decodes the whole preset so a key change never waits on the network. */
  const preloadPreset = useCallback(async () => {
    if (!preset) return;
    await engine.initialise();
    const loader = engine.assetLoader;
    if (!loader) return;
    setLoadingKeys(true);
    const result = await loader.preload(preset, (_loaded, _total, pitchClass) => {
      if (!loader.has(preset.id, pitchClass)) return;
      setReadyByPreset((current) => ({
        ...current,
        [preset.id]: [...new Set([...(current[preset.id] ?? []), pitchClass])],
      }));
    });
    setLoadingKeys(false);
    if (result.failed.length > 0) {
      setError({
        code: "asset-failed",
        message: `${result.failed.length} pad file(s) could not be loaded. Those keys stay unavailable.`,
      });
    }
  }, [engine, preset]);

  // Meter and fade progress: one animation frame loop, only while audible.
  const contextState = snapshot?.contextState;
  useEffect(() => {
    if (contextState !== "running") return;
    let frame = 0;
    const tick = () => {
      setMeter(engine.readMeter());
      setSnapshot(engine.snapshot());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, contextState]);

  useEffect(() => () => void engine.dispose(), [engine]);

  /** Decodes an arbitrary encoded file with the engine's own AudioContext. */
  const decodeForImport = useCallback(
    async (data: ArrayBuffer): Promise<AudioBuffer> => {
      const context = await engine.initialise();
      return context.decodeAudioData(data);
    },
    [engine],
  );

  /** Registers an imported pack and makes it the active preset. */
  const importLocalPack = useCallback(
    (created: PadPreset, pads: { pitchClass: PitchClass; data: ArrayBuffer }[]) => {
      const loader = engine.assetLoader;
      if (!loader) return;
      for (const pad of pads) loader.registerLocalAudio(created.id, pad.pitchClass, pad.data);
      setLocalPresets((current) => [...current.filter((entry) => entry.id !== created.id), created]);
      setPresetId(created.id);
    },
    [engine],
  );

  return {
    engine,
    snapshot,
    manifest,
    presets,
    preset,
    decodeForImport,
    importLocalPack,
    presetId,
    setPresetId,
    readyKeys,
    loadingKeys,
    preloadPreset,
    meter,
    error,
    clearError: () => setError(null),
    limits: PAD_LIMITS,
  };
}
