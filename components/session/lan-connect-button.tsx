"use client";

import { useState } from "react";

import { Modal } from "@/components/common/modal";
import { cloudJoinUrl, parseLanEndpoint } from "@/lib/session/lan-endpoint";

export function LanConnectButton() {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState("");
  const [joinKey, setJoinKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const connect = () => {
    const endpoint = parseLanEndpoint(host);
    const token = joinKey.trim();
    if (!endpoint) {
      setError("Enter a private host IP such as 192.168.1.20:3000.");
      return;
    }
    if (token.length < 12 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      setError("Enter the Join key shown by the local Worship Keys host.");
      return;
    }
    window.location.assign(cloudJoinUrl(window.location.origin, endpoint, token));
  };

  return (
    <>
      <button type="button" className="btn is-active" onClick={() => setOpen(true)}>
        IP Connect
      </button>
      {open ? (
        <Modal
          title="Connect to a local Worship Keys session"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn tone-quiet" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn is-active" onClick={connect}>Connect</button>
            </>
          }
        >
          <p className="hint">
            The church Mac must be running the local Worship Keys host. Open “Show join code” there and enter its IP and Join key below.
          </p>
          <label className="field">
            <span className="label">Host IP</span>
            <input
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="192.168.1.20:3000"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          <label className="field">
            <span className="label">Join key</span>
            <input
              value={joinKey}
              onChange={(event) => setJoinKey(event.target.value.trim())}
              placeholder="Paste the key from the host"
              className="mono"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          {error ? <div className="callout tone-warn">{error}</div> : null}
          <p className="hint">
            Chrome asks once for local-network permission. Audio remains on the host Mac; this device receives Nashville numbers and the live keyboard layer.
          </p>
          <a className="btn tone-quiet" href="http://localhost:3000">Open the local host on this Mac</a>
        </Modal>
      ) : null}
    </>
  );
}
