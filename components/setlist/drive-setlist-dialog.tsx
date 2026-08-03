"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/common/modal";
import { DeployToDriveButton } from "@/components/setlist/deploy-to-drive-button";
import { OpenDriveSetlistButton } from "@/components/setlist/open-drive-setlist-button";
import { ensureSupabaseSession, getSupabaseClient } from "@/lib/supabase/client";
import type { PersistedState } from "@/lib/storage/schema";

const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1pD8L0WbTM-i_HdhGT13vM3kbNDVWVcpB";

export function DriveSetlistDialog({
  state,
  onImport,
  onNotice,
}: {
  state: PersistedState;
  onImport: (state: PersistedState) => void;
  onNotice: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = useMemo(() => getSupabaseClient(), []);

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }

    void ensureSupabaseSession(supabase).then((nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const signIn = async () => {
    if (!supabase) {
      onNotice("Supabase is not configured for this deployment.");
      return;
    }
    if (!email.trim() || password.length < 8) {
      onNotice("Enter your email and a password with at least 8 characters.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      onNotice(error.message);
      return;
    }
    setPassword("");
    onNotice("Google Drive connected. You can deploy or open the church setlist now.");
  };

  const signOut = async () => {
    setBusy(true);
    const { error } = await supabase?.auth.signOut() ?? { error: null };
    setBusy(false);
    if (error) onNotice(error.message);
    else onNotice("Google Drive account disconnected from this browser.");
  };

  return (
    <>
      <button type="button" className={`btn${session ? " is-active" : " tone-quiet"}`} onClick={() => setOpen(true)}>
        {session ? "Drive connected" : "Google Drive"}
      </button>

      {open ? (
        <Modal title="Google Drive setlist" onClose={() => setOpen(false)}>
          <div className="drive-dialog-body">
            <p className="help-text">
              Prepare on your phone, deploy one current JSON file, then open that same file on the church Mac.
              Setlists still save locally in every browser as well.
            </p>

            {!authReady ? <p className="help-text">Checking Drive access…</p> : null}

            {authReady && !session ? (
              <div className="drive-auth-form">
                <div className="callout tone-warn">
                  Sign in with the authorized Worship Keys account. Public visitors cannot access the church Drive file.
                </div>
                <label className="field">
                  <span className="label">Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Password</span>
                  <input
                    type="password"
                    minLength={8}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void signIn()}
                  />
                </label>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void signIn()}>
                  {busy ? "Connecting…" : "Connect Google Drive"}
                </button>
              </div>
            ) : null}

            {session ? (
              <div className="drive-connected-panel">
                <div className="drive-account-row">
                  <span><b>Connected</b><small>{session.user.email ?? "Authorized Worship Keys account"}</small></span>
                  <button type="button" className="btn tone-quiet" disabled={busy} onClick={() => void signOut()}>
                    Disconnect
                  </button>
                </div>
                <div className="drive-action-card">
                  <span className="eyebrow">Saturday · phone</span>
                  <h3>Deploy the prepared setlist</h3>
                  <p>Replaces the single current Worship Keys JSON file in Drive.</p>
                  <DeployToDriveButton state={state} accessToken={session.access_token} onNotice={onNotice} />
                </div>
                <div className="drive-action-card">
                  <span className="eyebrow">Sunday · MacBook</span>
                  <h3>Open the Drive setlist</h3>
                  <p>Imports the current Drive file here and saves it locally on this device.</p>
                  <OpenDriveSetlistButton onImport={onImport} onNotice={onNotice} />
                </div>
                <a className="btn tone-quiet drive-folder-link" href={DRIVE_FOLDER_URL} target="_blank" rel="noreferrer">
                  Open Drive folder
                </a>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
