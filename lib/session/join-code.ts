import type { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/lib/supabase/client";

const JOIN_CODE_PATTERN = /^\d{6}$/;

type ResolveRequest = { requesterId?: string };
type ResolveResponse = { requesterId?: string; viewerToken?: string };

function randomId(bytes = 10): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function normaliseJoinCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isJoinCode(value: string): boolean {
  return JOIN_CODE_PATTERN.test(value);
}

/**
 * Registers the active browser-owned Cloud Live room behind a short spoken
 * code. The unguessable viewer token is disclosed only after a matching
 * request arrives; leader control still requires its separate PIN.
 */
export function registerCloudJoinCode(joinCode: string, viewerToken: string): () => void {
  const supabase = getSupabaseClient();
  if (!supabase || !isJoinCode(joinCode)) return () => undefined;

  const channel = supabase.channel(`wk-join-code:${joinCode}`, {
    config: { broadcast: { ack: true, self: false } },
  });
  channel
    .on("broadcast", { event: "resolve" }, ({ payload }) => {
      const request = payload as ResolveRequest;
      if (!request.requesterId) return;
      void channel.send({
        type: "broadcast",
        event: "resolved",
        payload: { requesterId: request.requesterId, viewerToken } satisfies ResolveResponse,
      });
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Resolves a six-digit Cloud Live code without a database or persistent room. */
export function resolveCloudJoinCode(joinCode: string, timeoutMs = 8_000): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) return Promise.reject(new Error("Cloud Live is not configured."));
  if (!isJoinCode(joinCode)) return Promise.reject(new Error("Enter all six digits."));

  return new Promise<string>((resolve, reject) => {
    const requesterId = randomId();
    let settled = false;
    const timer = { id: 0 };
    const channel: RealtimeChannel = supabase.channel(`wk-join-code:${joinCode}`, {
      config: { broadcast: { ack: true, self: false } },
    });

    const finish = (error?: Error, viewerToken?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer.id);
      void supabase.removeChannel(channel);
      if (error) reject(error);
      else if (viewerToken) resolve(viewerToken);
    };

    timer.id = window.setTimeout(
      () => finish(new Error("No active session was found for this code.")),
      timeoutMs,
    );

    channel
      .on("broadcast", { event: "resolved" }, ({ payload }) => {
        const response = payload as ResolveResponse;
        if (response.requesterId !== requesterId || !response.viewerToken) return;
        finish(undefined, response.viewerToken);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.send({ type: "broadcast", event: "resolve", payload: { requesterId } satisfies ResolveRequest });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          finish(new Error("The cloud connection is currently unavailable."));
        }
      });
  });
}
