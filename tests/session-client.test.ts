import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionConnection } from "@/lib/session/client";

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(): void {}

  close(): void {
    this.readyState = 3;
    queueMicrotask(() => this.onclose?.());
  }
}

describe("session client lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal("window", { location: { protocol: "http:", host: "localhost:3000" } });
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not reconnect a socket that was deliberately superseded", async () => {
    const connection = new SessionConnection({ onMessage: () => undefined, onStatus: () => undefined });
    connection.connect("viewer-token", "iPad");
    connection.connect("device-token", "iPad");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    connection.disconnect();
  });
});
