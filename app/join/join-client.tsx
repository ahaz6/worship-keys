"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { Modal } from "@/components/common/modal";
import { LeaderView } from "@/components/session/leader-view";
import { ViewerView } from "@/components/session/viewer-view";
import { useSession } from "@/lib/hooks/use-session";
import type { LeaderCommand } from "@/lib/session/protocol";

const DEVICE_TOKEN_KEY = "worship-keys.device-token";
const DEVICE_NAME_KEY = "worship-keys.device-name";

/**
 * One join screen for every musician device (spec 18.3).
 *
 * A scanned QR code lands here and becomes a viewer. The pianist then enters
 * the leader PIN to be upgraded. Roles are enforced on the server; this screen
 * simply shows the interface that matches the role it was given.
 */
export function JoinClient() {
  const params = useSearchParams();
  const session = useSession();
  const [deviceName, setDeviceName] = useState("");
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [sentCommandId, setSentCommandId] = useState<string | null>(null);
  const qrFallbackAttempted = useRef(false);

  const qrToken = params.get("t");
  // A command is in flight until the host's acknowledgement for it comes back.
  const pendingCommand = sentCommandId != null && session.lastAck?.messageId !== sentCommandId;

  // A device identity belongs to its issued token. Reloads and reopening the
  // same link reconnect silently, while a revoked token clears both values and
  // deliberately asks for a new name.
  useEffect(() => {
    const storedToken = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    const storedName = window.localStorage.getItem(DEVICE_NAME_KEY)?.trim();
    if (!storedToken || !storedName) return;
    const restore = window.setTimeout(() => {
      setDeviceName(storedName);
      setNameSubmitted(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!nameSubmitted) return;
    const storedToken = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    const token = storedToken ?? qrToken;
    if (!token) return;
    session.connect(token, deviceName);
    return () => session.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameSubmitted, qrToken]);

  useEffect(() => {
    if (!session.deviceToken) return;
    window.localStorage.setItem(DEVICE_TOKEN_KEY, session.deviceToken);
    if (deviceName.trim()) window.localStorage.setItem(DEVICE_NAME_KEY, deviceName.trim());
  }, [deviceName, session.deviceToken]);

  // A rejected stored token is usually from a restarted host. If this page was
  // opened from a fresh QR/link, retry that token once without asking again.
  useEffect(() => {
    if (session.status !== "rejected") return;
    window.localStorage.removeItem(DEVICE_TOKEN_KEY);
    if (/removed/i.test(session.message ?? "")) {
      window.localStorage.removeItem(DEVICE_NAME_KEY);
      qrFallbackAttempted.current = true;
      const reset = window.setTimeout(() => {
        setDeviceName("");
        setNameSubmitted(false);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    if (!qrToken || !nameSubmitted || qrFallbackAttempted.current) return;
    qrFallbackAttempted.current = true;
    session.connect(qrToken, deviceName);
  }, [deviceName, nameSubmitted, qrToken, session, session.message, session.status]);

  const submitPin = useCallback(async () => {
    setPinMessage(null);
    const token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
      setPinMessage("This device has not joined yet.");
      return;
    }
    const response = await fetch("/api/session/leader", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, pin }),
    });
    const body = (await response.json()) as { status?: string; reason?: string; error?: string };
    if (body.status === "granted") {
      setPinOpen(false);
      setPin("");
      // The server changes the role; reconnecting pulls the new one immediately.
      session.connect(token, deviceName || "Pianist iPad");
      return;
    }
    setPinMessage(body.reason ?? body.error ?? "That did not work.");
  }, [deviceName, pin, session]);

  const sendCommand = useCallback(
    (command: LeaderCommand) => {
      setSentCommandId(session.sendCommand(command));
    },
    [session],
  );

  if (!nameSubmitted) {
    return (
      <div className="centered-page">
        <div className="card">
          <BrandMark />
          <h2 style={{ margin: 0, fontSize: 20 }}>Join the session</h2>
          <p className="hint">
            Give this device a name so the host can recognise it. You will join as a monitor; the pianist can ask for
            leader access afterwards.
          </p>
          <input
            type="text"
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            placeholder="Pianist iPad"
            aria-label="Device name"
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const name = deviceName.trim();
              window.localStorage.setItem(DEVICE_NAME_KEY, name);
              setDeviceName(name);
              setNameSubmitted(true);
            }}
            disabled={!deviceName.trim() || (!qrToken && !window.localStorage.getItem(DEVICE_TOKEN_KEY))}
          >
            Join
          </button>
          {!qrToken ? (
            <p className="hint">
              This link has no join code. Scan the QR code shown on the host screen.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (session.status === "rejected") {
    return (
      <div className="centered-page">
        <div className="card">
          <BrandMark />
          <div className="callout tone-warn">{session.message ?? "This device is no longer part of the session."}</div>
          <p className="hint">Scan the QR code on the host screen again to rejoin.</p>
        </div>
      </div>
    );
  }

  const ageSeconds = Math.round(session.age / 1000);

  if (session.role === "leader") {
    return (
      <>
        <LeaderView
          snapshot={session.snapshot}
          stale={session.stale}
          ageSeconds={ageSeconds}
          pendingCommand={pendingCommand}
          lastMessage={session.message}
          onDismissMessage={session.dismissMessage}
          onCommand={sendCommand}
        />
      </>
    );
  }

  return (
    <>
      <ViewerView
        snapshot={session.snapshot}
        stale={session.stale}
        ageSeconds={ageSeconds}
        connected={session.status === "connected"}
        onRequestLeader={() => setPinOpen(true)}
      />
      {pinOpen ? (
        <Modal
          title="Request leader access"
          onClose={() => setPinOpen(false)}
          footer={
            <>
              <button type="button" className="btn tone-quiet" onClick={() => setPinOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn is-active" onClick={() => void submitPin()} disabled={pin.length < 6}>
                Request access
              </button>
            </>
          }
        >
          <p className="hint">Enter the six digit leader PIN shown on the host screen.</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            aria-label="Leader PIN"
            className="mono"
            style={{ fontSize: 22, letterSpacing: "0.2em", textAlign: "center" }}
          />
          {pinMessage ? <div className="callout tone-warn" style={{ marginTop: 12 }}>{pinMessage}</div> : null}
        </Modal>
      ) : null}
    </>
  );
}
