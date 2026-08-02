/**
 * Web MIDI device access (spec section 9.1).
 *
 * Permission is only requested after a deliberate user action, SysEx is never
 * requested, and every listener is detached on teardown so a device swap does
 * not leave a second handler running.
 */

import { type MidiEvent, parseMidiMessage } from "./midi-parser";

export type MidiInputInfo = {
  id: string;
  name: string;
  manufacturer: string;
};

export type MidiPermissionState = "unsupported" | "idle" | "requesting" | "granted" | "denied";

export type MidiConnectionEvent =
  | { type: "inputs"; inputs: MidiInputInfo[] }
  | { type: "device-lost"; id: string; name: string };

type MidiInputLike = {
  id: string;
  name: string | null;
  manufacturer: string | null;
  state: string;
  onmidimessage: ((event: { data: Uint8Array | null }) => void) | null;
};

type MidiAccessLike = {
  inputs: Map<string, MidiInputLike>;
  onstatechange: ((event: { port: { id: string; name: string | null; type: string; state: string } }) => void) | null;
};

export function isWebMidiSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
}

function describe(input: MidiInputLike): MidiInputInfo {
  return {
    id: input.id,
    name: input.name ?? "MIDI input",
    manufacturer: input.manufacturer ?? "",
  };
}

/**
 * Owns the MIDIAccess object and routes messages from exactly one selected
 * input. Deliberately not a React hook so teardown order stays explicit.
 */
export class MidiConnection {
  private access: MidiAccessLike | null = null;
  private selectedId: string | null = null;
  private attached: MidiInputLike | null = null;

  private onEvent: ((event: MidiEvent) => void) | null = null;
  private onConnection: ((event: MidiConnectionEvent) => void) | null = null;

  setHandlers(handlers: {
    onEvent: (event: MidiEvent) => void;
    onConnection: (event: MidiConnectionEvent) => void;
  }): void {
    this.onEvent = handlers.onEvent;
    this.onConnection = handlers.onConnection;
  }

  /** Requests access. Must be called from a user gesture handler. */
  async request(): Promise<MidiInputInfo[]> {
    if (!isWebMidiSupported()) throw new Error("unsupported");
    // No SysEx: Worship Keys never needs it, and asking would show a scarier prompt.
    const access = (await navigator.requestMIDIAccess({ sysex: false })) as unknown as MidiAccessLike;
    this.access = access;
    access.onstatechange = (event) => this.handleStateChange(event);
    return this.listInputs();
  }

  listInputs(): MidiInputInfo[] {
    if (!this.access) return [];
    return [...this.access.inputs.values()].filter((input) => input.state !== "disconnected").map(describe);
  }

  get selectedInputId(): string | null {
    return this.selectedId;
  }

  /** Routes messages from one input, detaching any previous one first. */
  selectInput(id: string | null): MidiInputInfo | null {
    this.detach();
    this.selectedId = id;
    if (!id || !this.access) return null;
    const input = this.access.inputs.get(id);
    if (!input) return null;
    input.onmidimessage = (event) => {
      if (!event.data) return;
      const parsed = parseMidiMessage(event.data);
      if (parsed) this.onEvent?.(parsed);
    };
    this.attached = input;
    return describe(input);
  }

  private handleStateChange(event: { port: { id: string; name: string | null; type: string; state: string } }): void {
    if (event.port.type !== "input") return;
    const inputs = this.listInputs();
    this.onConnection?.({ type: "inputs", inputs });
    if (event.port.state === "disconnected" && event.port.id === this.selectedId) {
      this.detach();
      this.onConnection?.({ type: "device-lost", id: event.port.id, name: event.port.name ?? "MIDI input" });
    }
  }

  private detach(): void {
    if (this.attached) {
      this.attached.onmidimessage = null;
      this.attached = null;
    }
  }

  dispose(): void {
    this.detach();
    if (this.access) this.access.onstatechange = null;
    this.access = null;
    this.selectedId = null;
    this.onEvent = null;
    this.onConnection = null;
  }
}
