/**
 * Audio device enumeration and the voice input stream (spec 17.5, 17.7).
 *
 * Two hard rules live here:
 *   - the microphone is only ever opened after an explicit user action,
 *   - the voice input is never connected to the audio output, because
 *     monitoring a stage mic through the pad bus is a feedback loop.
 */

export type AudioDeviceInfo = {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput";
};

export type VoiceInputResult = {
  stream: MediaStream;
  track: MediaStreamTrack;
  label: string;
  channelCount: number;
};

export function supportsDeviceEnumeration(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.enumerateDevices === "function";
}

/**
 * Lists audio devices. Labels stay empty until permission has been granted at
 * least once, which the UI reports rather than papering over.
 */
export async function listAudioDevices(): Promise<{ inputs: AudioDeviceInfo[]; outputs: AudioDeviceInfo[]; labelsVisible: boolean }> {
  if (!supportsDeviceEnumeration()) return { inputs: [], outputs: [], labelsVisible: false };
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs: AudioDeviceInfo[] = [];
  const outputs: AudioDeviceInfo[] = [];
  let labelsVisible = false;

  for (const device of devices) {
    if (device.label) labelsVisible = true;
    if (device.kind === "audioinput") {
      inputs.push({ deviceId: device.deviceId, label: device.label || "Microphone", kind: "audioinput" });
    } else if (device.kind === "audiooutput") {
      outputs.push({ deviceId: device.deviceId, label: device.label || "Audio output", kind: "audiooutput" });
    }
  }

  return { inputs, outputs, labelsVisible };
}

/**
 * Opens a voice input. Processing is disabled so a mixer feed is not mangled
 * by echo cancellation, and the requested channel count is a hint only — the
 * real number comes back from the track settings.
 */
export async function openVoiceInput(deviceId: string | null, requestedChannels = 2): Promise<VoiceInputResult> {
  const constraints: MediaStreamConstraints = {
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      channelCount: { ideal: requestedChannels },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const track = stream.getAudioTracks()[0];
  if (!track) {
    stream.getTracks().forEach((entry) => entry.stop());
    throw new Error("The selected device did not provide an audio track.");
  }
  const settings = track.getSettings() as MediaTrackSettings & { channelCount?: number };
  return {
    stream,
    track,
    label: track.label || "Voice input",
    channelCount: settings.channelCount ?? 1,
  };
}

export function closeVoiceInput(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Opens the browser's own output picker. Returns the chosen device, or null if
 * the user dismissed the dialog. Must be called from a user gesture.
 */
export async function chooseOutputDevice(): Promise<AudioDeviceInfo | null> {
  const picker = (navigator.mediaDevices as unknown as { selectAudioOutput?: () => Promise<MediaDeviceInfo> })
    .selectAudioOutput;
  if (typeof picker !== "function") throw new Error("This browser cannot choose an audio output.");
  try {
    const device = await picker.call(navigator.mediaDevices);
    return { deviceId: device.deviceId, label: device.label || "Selected output", kind: "audiooutput" };
  } catch {
    // The user closing the picker is not an error worth surfacing.
    return null;
  }
}

/** Subscribes to hot-plug events. Returns an unsubscribe function. */
export function watchDeviceChanges(onChange: () => void): () => void {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return () => {};
  navigator.mediaDevices.addEventListener("devicechange", onChange);
  return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
}

/** Long device names are shortened for the panel but kept for the tooltip. */
export function shortenDeviceLabel(label: string, maxLength = 26): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1).trimEnd()}…`;
}
