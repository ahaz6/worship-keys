/**
 * What this browser can and cannot actually do with audio devices
 * (spec 17.3, 17.4, 17.7).
 *
 * The rule this module exists to enforce: never offer a control that does not
 * work, and never claim a routing state the browser cannot observe. A 32x32
 * interface does not become 32 selectable channels just because the hardware
 * has them — only the channels the browser really exposes may be listed.
 */

export type OutputSelectionSupport = {
  canChooseOutput: boolean;
  /** Present when selection is unavailable; shown verbatim as help text. */
  reason: string | null;
};

export function detectOutputSelectionSupport(context: AudioContext | null): OutputSelectionSupport {
  const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  const hasPicker = typeof (mediaDevices as { selectAudioOutput?: unknown } | undefined)?.selectAudioOutput === "function";
  const hasSink = context != null && typeof (context as unknown as { setSinkId?: unknown }).setSinkId === "function";

  if (hasPicker && hasSink) return { canChooseOutput: true, reason: null };
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return { canChooseOutput: false, reason: "Audio output selection needs a secure connection (HTTPS or localhost)." };
  }
  return {
    canChooseOutput: false,
    reason: "This browser cannot choose an audio output. Choose the output in your system audio settings.",
  };
}

export type ExposedChannels = {
  /** Channel count the browser actually reported for the open track. */
  count: number;
  /** Selectable pairs derived from that count — never invented. */
  pairs: { label: string; first: number; second: number | null }[];
  /** True when the hardware has more channels than the browser hands over. */
  limitedByBrowser: boolean;
};

/**
 * Builds the channel list from a live MediaStreamTrack. A device advertising 32
 * inputs that opens as stereo yields exactly one pair, plus the note that the
 * rest must be patched on the desk.
 */
export function describeExposedChannels(track: MediaStreamTrack | null, hardwareChannelHint = 0): ExposedChannels {
  const settings = track?.getSettings() as (MediaTrackSettings & { channelCount?: number }) | undefined;
  const count = settings?.channelCount ?? (track ? 1 : 0);

  const pairs: ExposedChannels["pairs"] = [];
  for (let index = 0; index < count; index += 2) {
    const second = index + 1 < count ? index + 1 : null;
    pairs.push({
      label: second == null ? `Input ${index + 1}` : `Input ${index + 1}–${index + 2}`,
      first: index,
      second,
    });
  }

  return { count, pairs, limitedByBrowser: hardwareChannelHint > count };
}

/** One-line, honest summary for the Audio I/O panel. */
export function describeChannelSummary(channels: ExposedChannels): string {
  if (channels.count === 0) return "No input open";
  if (channels.count === 1) return "Input 1 · 1 channel exposed";
  return `Input 1–${channels.count} · ${channels.count} channels exposed`;
}
