import { describe, expect, it } from "vitest";

import {
  canRunHostCommand,
  canRunLeaderCommand,
  generateLeaderPin,
  hashPin,
  isLoopbackAddress,
  verifyPin,
} from "@/lib/session/authorization";
import { SessionStore } from "@/lib/session/session-store";
import { TRANSCRIPT_WINDOW, clientMessageSchema, snapshotSchema } from "@/lib/session/protocol";

function onlineStore(options?: ConstructorParameters<typeof SessionStore>[0]) {
  const store = new SessionStore(options);
  store.setHostOnline(true);
  return store;
}

function joinViewer(store: SessionStore, name = "iPad") {
  const result = store.join(store.viewerToken, name);
  if ("error" in result) throw new Error(result.error);
  return result;
}

describe("leader pin", () => {
  it("generates a six digit pin", () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(generateLeaderPin()).toMatch(/^\d{6}$/);
    }
  });

  it("verifies only the correct pin, against a salted hash", () => {
    const hashed = hashPin("123456");
    expect(hashed.hash).not.toContain("123456");
    expect(verifyPin("123456", hashed)).toBe(true);
    expect(verifyPin("123457", hashed)).toBe(false);
  });
});

describe("loopback detection", () => {
  it("recognises only local addresses", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("192.168.10.44")).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
  });
});

describe("role permissions", () => {
  it("never lets a viewer mutate anything", () => {
    expect(canRunLeaderCommand("viewer", false).allowed).toBe(false);
    expect(canRunLeaderCommand("viewer", true).allowed).toBe(false);
    expect(canRunHostCommand("viewer").allowed).toBe(false);
    expect(canRunHostCommand("leader").allowed).toBe(false);
    expect(canRunHostCommand("host").allowed).toBe(true);
  });

  it("blocks the leader while remote control is locked but never the host", () => {
    expect(canRunLeaderCommand("leader", false).allowed).toBe(true);
    expect(canRunLeaderCommand("leader", true).allowed).toBe(false);
    expect(canRunLeaderCommand("host", true).allowed).toBe(true);
  });
});

describe("joining", () => {
  it("gives a scanned QR code the viewer role and nothing more", () => {
    const store = onlineStore();
    const joined = joinViewer(store);
    expect(joined.role).toBe("viewer");
    expect(joined.token).not.toBe(store.viewerToken);
  });

  it("gives the loopback host token the host role", () => {
    const store = new SessionStore();
    const joined = store.join(store.hostToken, "MacBook");
    expect("error" in joined).toBe(false);
    if ("error" in joined) return;
    expect(joined.role).toBe("host");
  });

  it("rejects an unknown token", () => {
    const store = new SessionStore();
    expect(store.join("not-a-real-token", "iPad")).toEqual({
      error: "This join link is no longer valid. Scan the QR code again.",
    });
  });

  it("lets a reconnecting device keep its role via its own token", () => {
    const store = onlineStore();
    const joined = joinViewer(store);
    store.requestLeaderRole(joined.deviceId, store.pin);
    const rejoined = store.join(joined.token, "iPad");
    expect("error" in rejoined).toBe(false);
    if ("error" in rejoined) return;
    expect(rejoined.role).toBe("leader");
    expect(rejoined.deviceId).toBe(joined.deviceId);
  });

  it("refuses new devices once joins are locked", () => {
    const store = onlineStore();
    store.setJoinsLocked(true);
    expect(store.join(store.viewerToken, "Late iPad")).toEqual({
      error: "The host has locked new devices for this session.",
    });
  });
});

describe("leader handover", () => {
  it("promotes a device that offers the correct pin", () => {
    const store = onlineStore();
    const device = joinViewer(store);
    expect(store.requestLeaderRole(device.deviceId, store.pin)).toEqual({ status: "granted" });
    expect(store.currentLeaderId).toBe(device.deviceId);
  });

  it("rejects a wrong pin", () => {
    const store = onlineStore();
    const device = joinViewer(store);
    const wrong = store.pin === "000000" ? "111111" : "000000";
    expect(store.requestLeaderRole(device.deviceId, wrong).status).toBe("rejected");
    expect(store.currentLeaderId).toBeNull();
  });

  it("never lets a second device take over silently", () => {
    const store = onlineStore();
    const first = joinViewer(store, "Pianist iPad");
    const second = joinViewer(store, "Other iPad");
    store.requestLeaderRole(first.deviceId, store.pin);

    const outcome = store.requestLeaderRole(second.deviceId, store.pin);
    expect(outcome.status).toBe("needs-host-approval");
    expect(store.currentLeaderId).toBe(first.deviceId);

    // Only the host can complete the handover.
    const approval = store.setLeaderApproval(second.deviceId, true);
    expect(approval.demoted).toBe(first.deviceId);
    expect(store.currentLeaderId).toBe(second.deviceId);
    expect(store.getDevice(first.deviceId)?.role).toBe("viewer");
  });

  it("drops every leader when the pin is rotated", () => {
    const store = onlineStore();
    const device = joinViewer(store);
    store.requestLeaderRole(device.deviceId, store.pin);
    const newPin = store.rotatePin();
    expect(newPin).not.toBe("");
    expect(store.currentLeaderId).toBeNull();
    expect(store.getDevice(device.deviceId)?.role).toBe("viewer");
  });
});

describe("command authorization and revisions", () => {
  const command = { type: "prepare", tonic: 7, mode: "major" } as const;

  it("refuses a viewer's command", () => {
    const store = onlineStore();
    const viewer = joinViewer(store);
    expect(store.evaluateCommand(viewer.deviceId, "m1", store.revision, command)).toEqual({
      status: "denied",
      reason: "This device is view only.",
    });
  });

  it("forwards a confirmed leader's command to the host", () => {
    const store = onlineStore();
    const leader = joinViewer(store);
    store.requestLeaderRole(leader.deviceId, store.pin);
    expect(store.evaluateCommand(leader.deviceId, "m1", store.revision, command)).toMatchObject({ status: "forward" });
  });

  it("rejects a command built against a stale revision", () => {
    const store = onlineStore();
    const leader = joinViewer(store);
    store.requestLeaderRole(leader.deviceId, store.pin);
    const stale = store.revision;
    store.applyHostState({ padState: "playing" });
    expect(store.evaluateCommand(leader.deviceId, "m1", stale, command)).toMatchObject({ status: "stale" });
  });

  it("never runs the same message id twice", () => {
    const store = onlineStore();
    const leader = joinViewer(store);
    store.requestLeaderRole(leader.deviceId, store.pin);
    expect(store.evaluateCommand(leader.deviceId, "m1", store.revision, command).status).toBe("forward");
    expect(store.evaluateCommand(leader.deviceId, "m1", store.revision, command).status).toBe("duplicate");
  });

  it("blocks every leader command while remote control is locked", () => {
    const store = onlineStore();
    const leader = joinViewer(store);
    store.requestLeaderRole(leader.deviceId, store.pin);
    store.setRemoteControlLocked(true);
    expect(store.evaluateCommand(leader.deviceId, "m1", store.revision, command)).toMatchObject({
      status: "denied",
      reason: "Remote control is locked by the host.",
    });
  });

  it("refuses commands when the host is offline", () => {
    const store = new SessionStore();
    const leader = joinViewer(store);
    store.requestLeaderRole(leader.deviceId, store.pin);
    expect(store.evaluateCommand(leader.deviceId, "m1", store.revision, command)).toMatchObject({
      status: "denied",
      reason: "The host is offline. Command not applied.",
    });
  });

  it("refuses a revoked device", () => {
    const store = onlineStore();
    const leader = joinViewer(store);
    store.requestLeaderRole(leader.deviceId, store.pin);
    store.removeDevice(leader.deviceId);
    expect(store.evaluateCommand(leader.deviceId, "m1", store.revision, command)).toMatchObject({ status: "denied" });
  });
});

describe("snapshot", () => {
  it("advances the revision monotonically on every host update", () => {
    const store = new SessionStore();
    const start = store.revision;
    store.applyHostState({ padState: "playing" });
    store.applyHostState({ nashville: "5" });
    expect(store.revision).toBe(start + 2);
  });

  it("keeps only the most recent transcript lines", () => {
    const store = new SessionStore();
    for (let index = 0; index < TRANSCRIPT_WINDOW + 4; index += 1) {
      store.appendTranscript({ id: `s${index}`, text: `line ${index}`, final: true, at: index });
    }
    const transcript = store.getSnapshot().transcript;
    expect(transcript).toHaveLength(TRANSCRIPT_WINDOW);
    expect(transcript[transcript.length - 1]?.text).toBe(`line ${TRANSCRIPT_WINDOW + 3}`);
  });

  it("never lets a client patch overwrite the session id", () => {
    const store = new SessionStore();
    store.applyHostState({ sessionId: "spoofed", padState: "playing" });
    expect(store.getSnapshot().sessionId).toBe(store.sessionId);
  });

  it("produces a snapshot that validates against the wire schema", () => {
    const store = new SessionStore();
    store.applyHostState({ nashville: "5", detectedChord: "D", chordConfidence: 0.9 });
    expect(snapshotSchema.safeParse(store.getSnapshot()).success).toBe(true);
  });

  it("does not leak device tokens in the device list", () => {
    const store = onlineStore();
    joinViewer(store);
    for (const device of store.listDevices()) {
      expect(device).not.toHaveProperty("token");
    }
  });
});

describe("wire validation", () => {
  it("accepts a well formed command message", () => {
    const message = {
      type: "command",
      messageId: "abcd1234",
      expectedRevision: 3,
      command: { type: "set-key", tonic: 7, mode: "major" },
    };
    expect(clientMessageSchema.safeParse(message).success).toBe(true);
  });

  it("rejects an out-of-range key and an unknown command", () => {
    expect(
      clientMessageSchema.safeParse({
        type: "command",
        messageId: "abcd1234",
        expectedRevision: 0,
        command: { type: "set-key", tonic: 19, mode: "major" },
      }).success,
    ).toBe(false);
    expect(
      clientMessageSchema.safeParse({
        type: "command",
        messageId: "abcd1234",
        expectedRevision: 0,
        command: { type: "format-hard-drive" },
      }).success,
    ).toBe(false);
  });

  it("rejects a hello without a plausible token", () => {
    expect(clientMessageSchema.safeParse({ type: "hello", token: "short" }).success).toBe(false);
  });
});
