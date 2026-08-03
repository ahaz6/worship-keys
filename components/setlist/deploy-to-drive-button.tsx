"use client";

import { useState } from "react";

import type { PersistedState } from "@/lib/storage/schema";

export function DeployToDriveButton({
  state,
  accessToken,
  onNotice,
}: {
  state: PersistedState;
  accessToken: string;
  onNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const deploy = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/deploy-setlist", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(state),
      });
      const result = await response.json() as { error?: string; file?: { name?: string } };
      if (!response.ok) throw new Error(result.error || "Google Drive deploy failed.");
      onNotice(`${result.file?.name ?? "Setlist JSON"} was deployed to Google Drive.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Google Drive deploy failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="btn-primary drive-deploy-button" disabled={busy} onClick={() => void deploy()}>
      {busy ? "Deploying…" : "Deploy to Google Drive"}
    </button>
  );
}
