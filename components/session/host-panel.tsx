"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/common/modal";
import { Status } from "@/components/common/status";
import { isPrivateIPv4 } from "@/lib/session/lan-addresses";
import type { ConnectedDevice } from "@/lib/session/protocol";

export type HostBootstrap = {
  sessionId: string;
  hostToken: string;
  viewerToken: string;
  leaderPin: string;
  joinCode: string;
  joinUrl: string;
  localJoinUrl: string;
  cloudJoinUrl: string;
  addresses: { interface: string; address: string }[];
  port: number;
  transport?: "local" | "cloud";
};

/**
 * Host controls for the local live session (spec 18.2, 18.3).
 *
 * The QR code and PIN live here and only here — they are not left on the
 * performance screen during a service. Everything device-related is host-only.
 */
export function HostPanel({
  bootstrap,
  bootstrapError,
  connected,
  devices,
  remoteLocked,
  joinsLocked,
  onToggleRemoteLock,
  onToggleJoinsLock,
  onApproveLeader,
  onRevokeDevice,
  onRotatePin,
  onShowJoin,
  setlistSongCount,
  setlistSaved,
  padKeysReady,
  audioStarted,
}: {
  bootstrap: HostBootstrap | null;
  bootstrapError: string | null;
  connected: boolean;
  devices: ConnectedDevice[];
  remoteLocked: boolean;
  joinsLocked: boolean;
  onToggleRemoteLock: () => void;
  onToggleJoinsLock: () => void;
  onApproveLeader: (deviceId: string, approved: boolean) => void;
  onRevokeDevice: (deviceId: string) => void;
  onRotatePin: () => void;
  onShowJoin?: () => void;
  setlistSongCount: number;
  setlistSaved: boolean;
  padKeysReady: number;
  audioStarted: boolean;
}) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const localChurchMode = Boolean(bootstrap && bootstrap.transport !== "cloud");
  const joinUrl = localChurchMode ? bootstrap?.localJoinUrl : bootstrap?.cloudJoinUrl;
  const preferredAddress = bootstrap?.addresses[0]?.address ?? null;
  const routerReady = Boolean(preferredAddress && isPrivateIPv4(preferredAddress));
  const padsReady = audioStarted && padKeysReady === 12;
  const setlistReady = setlistSongCount > 0 && setlistSaved;
  const offlineReady = Boolean(localChurchMode && connected && routerReady && padsReady && setlistReady);

  const openAndCopyJoinLink = async () => {
    if (!bootstrap || !joinUrl) return;
    // This click is a trusted host gesture, so it is the safest moment to
    // unlock Web Audio before a remote Leader can request a fade.
    onShowJoin?.();
    setJoinOpen(true);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
        const field = document.createElement("textarea");
        field.value = joinUrl;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Copy was not available.");
      }
      setCopyNotice("Join link copied to clipboard.");
    } catch {
      setCopyNotice("Join code opened. Copy the address below manually.");
    }
  };

  // The QR image is fetched only while the join dialog is actually open.
  useEffect(() => {
    if (!joinOpen || !bootstrap || !joinUrl) return;
    let cancelled = false;
    fetch(`/api/session/qr?url=${encodeURIComponent(joinUrl)}`)
      .then((response) => response.json())
      .then((body: { dataUrl?: string }) => {
        if (!cancelled && body.dataUrl) setQr(body.dataUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [joinOpen, bootstrap, joinUrl]);

  const others = devices.filter((device) => device.role !== "host");
  const waiting = others.filter((device) => device.leaderRequested);

  return (
    <section className="panel-card host-session-panel" aria-label="Live session">
      <div className="section-title" style={{ padding: 0 }}>
        <span>{localChurchMode ? "Offline Church Mode" : "Live session"}</span>
        <span>{others.length} device{others.length === 1 ? "" : "s"}</span>
      </div>

      {localChurchMode ? (
        <div className={`church-readiness${offlineReady ? " is-ready" : ""}`}>
          <div className="church-readiness-head">
            <span className="eyebrow">Sunday readiness</span>
            <strong>{offlineReady ? "READY · INTERNET NOT REQUIRED" : "PREPARATION NEEDED"}</strong>
          </div>
          <div className="church-check-grid">
            <span className={connected ? "is-ready" : ""}><b>{connected ? "✓" : "○"}</b> Local host</span>
            <span className={routerReady ? "is-ready" : ""}><b>{routerReady ? "✓" : "○"}</b> Router IP {preferredAddress ?? "missing"}</span>
            <span className={setlistReady ? "is-ready" : ""}><b>{setlistReady ? "✓" : "○"}</b> Setlist {setlistSongCount > 0 ? setlistSaved ? "saved" : "saving" : "empty"}</span>
            <span className={padsReady ? "is-ready" : ""}><b>{padsReady ? "✓" : "○"}</b> Pads {audioStarted ? `${padKeysReady}/12` : "not checked"}</span>
          </div>
          {!routerReady ? <p className="hint">Connect this Mac to the church router or access point before showing the QR code.</p> : null}
          {!padsReady ? (
            <button type="button" className="btn is-active" onClick={onShowJoin}>
              Check all offline pads
            </button>
          ) : null}
        </div>
      ) : null}

      {bootstrapError ? (
        <div className="callout tone-warn">{bootstrapError}</div>
      ) : (
        <Status
          tone={connected ? "ok" : "warn"}
          state={connected ? "Host online" : "Host offline"}
          detail={bootstrap?.transport === "cloud" ? "Supabase Realtime · Vercel" : bootstrap ? `${bootstrap.addresses[0]?.address ?? "localhost"}:${bootstrap.port}` : "starting"}
        />
      )}

      <div className="btn-row">
        <button type="button" className="btn" onClick={() => void openAndCopyJoinLink()} disabled={!bootstrap || (localChurchMode && !routerReady)}>
          {localChurchMode ? "Show local join QR" : "Show join code"}
        </button>
        <button type="button" className={`btn${remoteLocked ? " is-active" : ""}`} onClick={onToggleRemoteLock}>
          {remoteLocked ? "Remote control locked" : "Lock remote control"}
        </button>
      </div>

      {waiting.length > 0 ? (
        <div className="callout tone-warn">
          <span>
            {waiting.length} device{waiting.length === 1 ? "" : "s"} asked for leader access.
          </span>
        </div>
      ) : null}

      <div className="device-list">
        {others.length === 0 ? <p className="hint">No musician devices have joined yet.</p> : null}
        {others.map((device) => (
          <div key={device.deviceId} className="device-row">
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {device.name}
              <br />
              <small className="hint">
                {device.role === "leader" ? "Leader" : "View only"}
                {device.leaderRequested ? " · asking for leader" : ""}
              </small>
            </span>
            <button
              type="button"
              className={`btn${device.role === "leader" ? " is-active" : ""}`}
              onClick={() => onApproveLeader(device.deviceId, device.role !== "leader")}
              style={{ minHeight: 28, padding: "4px 8px", fontSize: 10 }}
            >
              {device.role === "leader" ? "Remove leader" : "Make leader"}
            </button>
            <button
              type="button"
              className="btn tone-danger"
              onClick={() => onRevokeDevice(device.deviceId)}
              style={{ minHeight: 28, padding: "4px 8px", fontSize: 10 }}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>

      <p className="hint">
        Audio always stays on this machine. If the network drops, the pads keep playing and remote control stops
        accepting changes.
      </p>

      {joinOpen && bootstrap ? (
        <Modal title="Join this session" onClose={() => setJoinOpen(false)}>
          {copyNotice ? <div className="callout tone-info">{copyNotice}</div> : null}
          <p className="hint">Musicians scan the QR or enter the six-digit code in Worship Join. They land in the view-only monitor; the pianist then enters the separate leader PIN.</p>
          <div className="qr">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL generated per session, not a static asset
              <img src={qr} alt={`QR code for ${joinUrl}`} />
            ) : (
              <span className="hint" style={{ color: "#333" }}>
                Generating…
              </span>
            )}
          </div>
          <div className="field">
            <span className="label">Join address</span>
            <strong className="mono" style={{ fontSize: 13, wordBreak: "break-all" }}>
              {joinUrl}
            </strong>
          </div>
          <div className="field">
            <span className="label">Six-digit session code</span>
            <strong className="pin-display join-code-display">{bootstrap.joinCode}</strong>
            <span className="hint">Open the fixed “Worship Join” Home Screen app and enter this code.</span>
          </div>
          <div className="field">
            <span className="label">Leader PIN</span>
            <span className="pin-display">{bootstrap.leaderPin}</span>
          </div>
          {bootstrap.addresses.length > 1 ? (
            <p className="hint">
              Other addresses on this machine: {bootstrap.addresses.slice(1).map((entry) => entry.address).join(", ")}
            </p>
          ) : null}
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button type="button" className={`btn${joinsLocked ? " is-active" : ""}`} onClick={onToggleJoinsLock}>
              {joinsLocked ? "New joins locked" : "Lock new joins"}
            </button>
            <button type="button" className="btn" onClick={onRotatePin}>
              New leader PIN
            </button>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            {bootstrap.transport === "cloud"
              ? "The Vercel host tab owns MIDI and pad audio. Join devices receive the live Nashville, setlist and controls through Supabase Realtime; no local server is required."
              : <>This QR stays entirely inside the local church network and connects directly to this Mac. Internet, Vercel and Supabase are not used.</>}
          </p>
        </Modal>
      ) : null}
    </section>
  );
}
