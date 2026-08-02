"use client";

import { useRef } from "react";

import { migratePersistedState, type PersistedState } from "@/lib/storage/schema";
import { toExportJson } from "@/lib/storage/setlist-repository";

export function SetlistTransfer({
  state,
  onImport,
  onNotice,
}: {
  state: PersistedState;
  onImport: (state: PersistedState) => void;
  onNotice: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const exportSetlist = () => {
    const blob = new Blob([toExportJson(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.setlist.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "setlist"}.worship-keys.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSetlist = async (file: File | undefined) => {
    if (!file) return;
    try {
      const migrated = migratePersistedState(JSON.parse(await file.text()));
      if (!migrated.ok) {
        onNotice(migrated.message);
        return;
      }
      onImport(migrated.state);
      onNotice("Setlist imported and saved locally.");
    } catch {
      onNotice("That file is not a valid Worship Keys setlist.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="btn-row">
      <button type="button" className="btn tone-quiet" onClick={exportSetlist}>
        Export setlist
      </button>
      <button type="button" className="btn tone-quiet" onClick={() => inputRef.current?.click()}>
        Import setlist
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => void importSetlist(event.target.files?.[0])}
      />
    </div>
  );
}
