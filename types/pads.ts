import type { PitchClass } from "@/lib/music/pitch";

export type PadKeyAsset = {
  pitchClass: PitchClass;
  note: string;
  url: string;
  loopStart: number;
  loopEnd: number;
  gainTrim: number;
  /** Pitch-preserving offline renders selected automatically from song BPM. */
  tempoVariants?: {
    maxBpm: number;
    url: string;
    loopStart: number;
    loopEnd: number;
    gainTrim: number;
  }[];
};

export type PadPreset = {
  id: string;
  name: string;
  description: string;
  /** `neutral` packs contain no third and serve both major and minor keys. */
  mode: "neutral" | "major" | "minor";
  keys: PadKeyAsset[];
  /** Set for packs the user imported locally rather than shipped presets. */
  local?: boolean;
};

export type PadManifest = {
  version: number;
  license: string;
  sampleRate: number;
  loopSeconds: number;
  presets: PadPreset[];
};

export type PadLoadState = "idle" | "loading" | "ready" | "error";
