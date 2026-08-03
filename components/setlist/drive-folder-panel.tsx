"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  DRIVE_CURRENT_FILE,
  chooseDriveFolder,
  ensureDrivePermission,
  loadDriveFolderHandle,
  readStateFromDrive,
  supportsDriveFolderSync,
  writeStateToDrive,
} from "@/lib/storage/drive-folder-sync";
import type { PersistedState } from "@/lib/storage/schema";

const DRIVE_URL = "https://drive.google.com/drive/folders/1pD8L0WbTM-i_HdhGT13vM3kbNDVWVcpB";

type StoredHandle = Awaited<ReturnType<typeof loadDriveFolderHandle>>;

export function DriveFolderPanel({
  state,
  onImport,
  onNotice,
  autoSave = false,
}: {
  state: PersistedState;
  onImport: (state: PersistedState) => void;
  onNotice: (message: string) => void;
  autoSave?: boolean;
}) {
  const [handle, setHandle] = useState<StoredHandle>(null);
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const latestState = useRef(state);

  useEffect(() => {
    latestState.current = state;
  }, [state]);

  useEffect(() => {
    void loadDriveFolderHandle().then(async (saved) => {
      setHandle(saved);
      if (saved) setPermission(await ensureDrivePermission(saved));
    });
  }, []);

  const connect = useCallback(async (chooseAnother = false) => {
    setBusy(true);
    try {
      const selected = !chooseAnother && handle ? handle : await chooseDriveFolder();
      if (!(await ensureDrivePermission(selected, true))) throw new Error("Folder access was not granted.");
      setHandle(selected);
      setPermission(true);
      await writeStateToDrive(selected, latestState.current);
      onNotice(`${DRIVE_CURRENT_FILE} is now synced with ${selected.name}.`);
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") {
        onNotice(error instanceof Error ? error.message : "The Drive folder could not be connected.");
      }
    } finally {
      setBusy(false);
    }
  }, [handle, onNotice]);

  useEffect(() => {
    if (!autoSave || !handle || !permission) return;
    const timer = setTimeout(() => {
      void writeStateToDrive(handle, state).catch(() => setPermission(false));
    }, 900);
    return () => clearTimeout(timer);
  }, [autoSave, handle, permission, state]);

  const save = async () => {
    if (!handle || !(await ensureDrivePermission(handle, true))) return void connect();
    setBusy(true);
    try {
      await writeStateToDrive(handle, state);
      setPermission(true);
      onNotice(`Saved to ${handle.name}/${DRIVE_CURRENT_FILE}.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The setlist could not be saved to Drive.");
    } finally {
      setBusy(false);
    }
  };

  const load = async () => {
    if (!handle || !(await ensureDrivePermission(handle, true))) return void connect();
    setBusy(true);
    try {
      onImport(await readStateFromDrive(handle));
      setPermission(true);
      onNotice(`Loaded ${DRIVE_CURRENT_FILE} from ${handle.name}.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No Worship Keys setlist was found in that folder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="drive-sync-card" aria-label="Google Drive folder sync">
      <div>
        <strong>Google Drive mirror</strong>
        <p>
          {handle && permission ? `Connected to ${handle.name}` : "Choose the locally synced Worship Keys Sets folder once."}
        </p>
      </div>
      <div className="btn-row">
        <button type="button" className="btn is-active" disabled={busy || !supportsDriveFolderSync()} onClick={() => void save()}>
          {handle && permission ? "Export JSON to Drive now" : "Export JSON to Google Drive"}
        </button>
        <button type="button" className="btn" disabled={busy || !handle} onClick={() => void load()}>
          Load JSON from Drive
        </button>
        <a className="btn drive-link" href={DRIVE_URL} target="_blank" rel="noreferrer">Open Drive</a>
      </div>
      {handle ? (
        <button type="button" className="drive-reconnect-link" disabled={busy} onClick={() => void connect(true)}>
          Change connected folder
        </button>
      ) : null}
      {!supportsDriveFolderSync() ? <small>Automatic folder sync needs Chrome or Edge on macOS.</small> : null}
    </section>
  );
}
