/**
 * Allen & Heath SQ guidance (spec 17.6).
 *
 * The SQ presents a class-compliant 32x32 USB interface, but a browser only
 * hands Worship Keys a stereo pair. The safe, reliable web workflow is
 * therefore to patch whatever should reach the app onto SQ USB 1–2, and to
 * return the pads on a dedicated SQ stereo channel. This module holds that
 * guidance as data so the UI and the docs cannot drift apart.
 */

export type RoutingStep = {
  title: string;
  detail: string;
};

export type RoutingSetup = {
  id: "separate-devices" | "sq-both-directions";
  name: string;
  summary: string;
  steps: RoutingStep[];
  cautions: string[];
};

export const SQ_ROUTING_SETUPS: readonly RoutingSetup[] = [
  {
    id: "separate-devices",
    name: "Setup A — mic through the SQ, pads on the headphone output",
    summary: "Voice input and pad output stay on two different devices. Simplest to get right the first time.",
    steps: [
      { title: "Mic to SQ", detail: "Patch the MD microphone channel's direct out to SQ USB output 1–2." },
      { title: "Voice input", detail: "In Worship Keys choose the SQ as the voice device. Only speech goes through it." },
      { title: "Pad output", detail: "Leave the audio output on System default and take the computer's 3.5 mm output." },
      { title: "Into the keyboard", detail: "Run a TRS cable into the keyboard's AUX IN or LINE IN — never into an output." },
      { title: "Set the level", detail: "Lower Main Volume before plugging in, then raise it slowly while watching the meter." },
    ],
    cautions: [
      "Long analogue runs pick up hum. Use a DI box or a USB interface for a permanent install.",
      "MIDI alone carries no pad audio. The keyboard must accept a line-level input.",
    ],
  },
  {
    id: "sq-both-directions",
    name: "Setup B — mic and pads both over SQ USB",
    summary: "One device in both directions. Needs a deliberate patch on the desk so nothing feeds back.",
    steps: [
      { title: "Mic to the Mac", detail: "Patch the MD microphone direct out to SQ USB output 1–2 (SQ → Mac)." },
      { title: "Pads back to the SQ", detail: "Choose the SQ as the audio output. macOS sends it on USB 1–2 (Mac → SQ)." },
      { title: "Dedicated return", detail: "Create a stereo input channel named Worship Keys Pads and patch USB 1/2 to it." },
      { title: "Sample rate first", detail: "Fix the SQ sample rate before opening the browser, then start Worship Keys." },
      { title: "Soundcheck", detail: "Test at a low level well before the service, then lock remote control." },
    ],
    cautions: [
      "Never patch the pad return back into the same USB send — that is a feedback loop.",
      "Changing the SQ sample rate mid-service forces an AudioContext restart. Do it before you start.",
      "Clicks and pops are almost always a sample rate or clocking mismatch, not a Worship Keys fault.",
    ],
  },
];

/**
 * Shown next to the channel list whenever the browser exposes fewer channels
 * than the hardware has.
 */
export const ADVANCED_ROUTING_NOTE =
  "For arbitrary SQ USB channels, patch the desired source to USB 1–2 on the SQ. The browser only exposes a stereo pair.";

export const CONNECTION_HELP = {
  title: "Connecting the pad output",
  rules: [
    "Always go into an input: AUX IN, LINE IN, a DI box, or an interface.",
    "Never connect the computer's headphone output to an output on the keyboard.",
    "Turn Main Volume down before plugging in, then raise it slowly.",
    "A stereo AUX input needs a TRS cable that matches that socket.",
    "For a mixer, use a 3.5 mm stereo to 2 x 6.3 mm cable, or better a stereo DI or interface.",
    "For long cable runs or a permanent stage setup, use a USB interface or a DI box.",
  ],
} as const;
