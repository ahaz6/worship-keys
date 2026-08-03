"use client";

import { useRef } from "react";

import { migratePersistedState, type PersistedState } from "@/lib/storage/schema";

type OpenFileHandle = { getFile(): Promise<File> };

async function readSetlistFile(file: File): Promise<PersistedState> {
  const migrated = migratePersistedState(JSON.parse(await file.text()));
  if (!migrated.ok) throw new Error(migrated.message);
  return migrated.state;
}

/** Opens the native macOS picker, which exposes a mounted Google Drive folder. */
export function OpenDriveSetlistButton({
  onImport,
  onNotice,
}: {
  onImport: (state: PersistedState) => void;
  onNotice: (message: string) => void;
}) {
  const fallbackInput = useRef<HTMLInputElement>(null);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      onImport(await readSetlistFile(file));
      onNotice(`Loaded ${file.name} from Google Drive.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "That file is not a valid Worship Keys setlist.");
    } finally {
      if (fallbackInput.current) fallbackInput.current.value = "";
    }
  };

  const open = async () => {
    const picker = (window as unknown as {
      showOpenFilePicker?: (options: {
        id: string;
        multiple: false;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<OpenFileHandle[]>;
    }).showOpenFilePicker;

    if (!picker) {
      fallbackInput.current?.click();
      return;
    }

    try {
      const [handle] = await picker({
        id: "worship-keys-drive-setlist",
        multiple: false,
        types: [{ description: "Worship Keys setlist", accept: { "application/json": [".json"] } }],
      });
      if (handle) await importFile(await handle.getFile());
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") {
        onNotice(error instanceof Error ? error.message : "The Drive setlist could not be opened.");
      }
    }
  };

  return (
    <>
      <button type="button" className="btn drive-open-button" onClick={() => void open()}>
        Open Drive setlist
      </button>
      <input
        ref={fallbackInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => void importFile(event.target.files?.[0])}
      />
    </>
  );
}

