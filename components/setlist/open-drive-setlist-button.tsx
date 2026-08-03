"use client";

import { useState } from "react";

import { ensureSupabaseSession } from "@/lib/supabase/client";
import { migratePersistedState, type PersistedState } from "@/lib/storage/schema";

/** Imports the one fixed church setlist from Drive without showing a file picker. */
export function OpenDriveSetlistButton({
  onImport,
  onNotice,
}: {
  onImport: (state: PersistedState) => void;
  onNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const session = await ensureSupabaseSession();

      const response = await fetch("/api/open-setlist-from-drive", {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        cache: "no-store",
      });
      const result = (await response.json()) as { error?: string; state?: unknown; file?: { name?: string } };
      if (!response.ok) throw new Error(result.error || "The Drive setlist could not be opened.");
      const migrated = migratePersistedState(result.state);
      if (!migrated.ok) throw new Error(migrated.message);

      onImport(migrated.state);
      onNotice(`${result.file?.name ?? "Drive setlist"} imported successfully.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The Drive setlist could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="btn drive-open-button" disabled={busy} onClick={() => void open()}>
      {busy ? "Opening Drive setlist…" : "Open setlist from Drive"}
    </button>
  );
}
