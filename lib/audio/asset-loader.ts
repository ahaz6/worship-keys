/**
 * Pad asset loading and decoding (spec 8.9).
 *
 * Every key of the active preset is fetched and decoded before it is needed, so
 * a key change during a service never waits on the network. Decoded buffers are
 * cached per preset+key; the same key is never decoded twice.
 */

import type { PadKeyAsset, PadManifest, PadPreset } from "@/types/pads";
import type { PitchClass } from "@/lib/music/pitch";

export type PadBufferKey = string;

function bufferKey(presetId: string, pitchClass: PitchClass, url = "local"): PadBufferKey {
  return `${presetId}:${pitchClass}:${url}`;
}

export class PadAssetLoader {
  private readonly buffers = new Map<PadBufferKey, AudioBuffer>();
  private readonly pending = new Map<PadBufferKey, Promise<AudioBuffer>>();
  /** Local imports live as blobs rather than as URLs under /pads. */
  private readonly localBlobs = new Map<PadBufferKey, ArrayBuffer>();

  constructor(private readonly context: BaseAudioContext) {}

  static async loadManifest(signal?: AbortSignal): Promise<PadManifest> {
    // The manifest controls which packs are visible. It must never survive a
    // pack replacement in the browser cache; the much larger audio files may
    // still be cached by their versioned URLs.
    const response = await fetch(`/pads/manifest.json?v=${Date.now()}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Pad manifest unavailable (${response.status})`);
    return (await response.json()) as PadManifest;
  }

  /** Registers audio the user imported from their own files. */
  registerLocalAudio(presetId: string, pitchClass: PitchClass, data: ArrayBuffer): void {
    this.localBlobs.set(bufferKey(presetId, pitchClass), data);
  }

  has(presetId: string, pitchClass: PitchClass, url?: string): boolean {
    if (url) return this.buffers.has(bufferKey(presetId, pitchClass, url));
    return [...this.buffers.keys()].some((key) => key.startsWith(`${presetId}:${pitchClass}:`));
  }

  get(presetId: string, pitchClass: PitchClass): AudioBuffer | null {
    return [...this.buffers.entries()].find(([key]) => key.startsWith(`${presetId}:${pitchClass}:`))?.[1] ?? null;
  }

  async load(presetId: string, asset: PadKeyAsset): Promise<AudioBuffer> {
    const key = bufferKey(presetId, asset.pitchClass, asset.url);
    const cached = this.buffers.get(key);
    if (cached) return cached;
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;

    const request = (async () => {
      const local = this.localBlobs.get(bufferKey(presetId, asset.pitchClass));
      const encoded = local ?? (await this.fetchEncoded(asset.url));
      // decodeAudioData detaches the buffer, so local imports get a copy.
      const buffer = await this.context.decodeAudioData(local ? encoded.slice(0) : encoded);
      this.buffers.set(key, buffer);
      this.pending.delete(key);
      return buffer;
    })();

    this.pending.set(key, request);
    try {
      return await request;
    } catch (error) {
      this.pending.delete(key);
      throw error;
    }
  }

  private async fetchEncoded(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Pad audio unavailable (${response.status})`);
    return response.arrayBuffer();
  }

  /**
   * Loads a whole preset. Reports progress so the UI can show which keys are
   * already safe to use instead of blocking the entire ribbon.
   */
  async preload(
    preset: PadPreset,
    onProgress?: (loaded: number, total: number, pitchClass: PitchClass) => void,
  ): Promise<{ loaded: PitchClass[]; failed: { pitchClass: PitchClass; message: string }[] }> {
    const loaded: PitchClass[] = [];
    const failed: { pitchClass: PitchClass; message: string }[] = [];

    for (const asset of preset.keys) {
      try {
        await this.load(preset.id, asset);
        loaded.push(asset.pitchClass);
      } catch (error) {
        failed.push({ pitchClass: asset.pitchClass, message: error instanceof Error ? error.message : "Decode failed" });
      }
      onProgress?.(loaded.length + failed.length, preset.keys.length, asset.pitchClass);
    }

    return { loaded, failed };
  }
}
