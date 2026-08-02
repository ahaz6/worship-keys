"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/common/modal";
import { Status } from "@/components/common/status";
import type { ConnectedDevice } from "@/lib/session/protocol";

export type HostBootstrap = {
  sessionId: string;
  hostToken: string;
  viewerToken: string;
  leaderPin: string;
  joinUrl: string;
  addresses: { interface: string; address: string }[];
  port: number;
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
}) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  // The QR image is fetched only while the join dialog is actually open.
  useEffect(() => {
    if (!joinOpen || !bootstrap) return;
    let cancelled = false;
    fetch(`/api/session/qr?url=${encodeURIComponent(bootstrap.joinUrl)}`)
      .then((response) => response.json())
      .then((body: { dataUrl?: string }) => {
        if (!cancelled && body.dataUrl) setQr(body.dataUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [joinOpen, bootstrap]);

  const others = devices.filter((device) => device.role !== "host");
  const waiting = others.filter((device) => device.leaderRequested);

  return (
    <section className="panel-card" aria-label="Live session">
      <div className="section-title" style={{ padding: 0 }}>
        <span>Live session</span>
        <span>{others.length} device{others.length === 1 ? "" : "s"}</span>
      </div>

      {bootstrapError ? (
        <div className="callout tone-warn">{bootstrapError}</div>
      ) : (
        <Status
          tone={connected ? "ok" : "warn"}
          state={connected ? "Host online" : "Host offline"}
          detail={bootstrap ? `${bootstrap.addresses[0]?.address ?? "localhost"}:${bootstrap.port}` : "starting"}
        />
      )}

      <div className="btn-row">
        <button type="button" className="btn" onClick={() => setJoinOpen(true)} disabled={!bootstrap}>
          Show join code
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
          <p className="hint">Musicians scan this code and land in the view-only monitor. The pianist then enters the leader PIN.</p>
          <div className="qr">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL generated per session, not a static asset
              <img src={qr} alt={`QR code for ${bootstrap.joinUrl}`} />
            ) : (
              <span className="hint" style={{ color: "#333" }}>
                Generating…
              </span>
            )}
          </div>
          <div className="field">
            <span className="label">Join address</span>
            <strong className="mono" style={{ fontSize: 13, wordBreak: "break-all" }}>
              {bootstrap.joinUrl}
            </strong>
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
            A guest network with client isolation will stop iPads reaching this address. Use a dedicated network and give
            this machine a fixed IP.
          </p>
        </Modal>
      ) : null}
    </section>
  );
}
