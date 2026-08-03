import { NextResponse } from "next/server";

import { downloadSetlistFromDrive, readDriveServiceAccountConfig } from "@/lib/google-drive/service-account";
import { migratePersistedState } from "@/lib/storage/schema";
import { authenticatedUserId, canAccessDriveSetlist } from "@/lib/supabase/server-auth";

export const runtime = "nodejs";

const DEFAULT_CLOUD_API = "https://worship-keys-psi.vercel.app";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const userId = await authenticatedUserId(authorization);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to the Worship Keys cloud planner once before opening the Drive setlist." }, { status: 401 });
  }
  if (!(process.env.GOOGLE_DRIVE_DEPLOY_USER_IDS ?? "").trim() && readDriveServiceAccountConfig()) {
    return NextResponse.json({ error: "Google Drive access has no authorized users yet." }, { status: 503 });
  }

  // The local audio host deliberately has no Google private key. It forwards
  // this authenticated read to the Vercel app, where the secret already lives.
  if (!readDriveServiceAccountConfig()) {
    const cloudOrigin = (process.env.WORSHIP_KEYS_CLOUD_API_URL ?? DEFAULT_CLOUD_API).replace(/\/$/, "");
    if (new URL(request.url).origin === cloudOrigin) {
      return NextResponse.json({ error: "Google Drive access is not configured on Vercel yet." }, { status: 503 });
    }
    const response = await fetch(`${cloudOrigin}/api/open-setlist-from-drive`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  }

  if (!canAccessDriveSetlist(userId)) {
    return NextResponse.json({ error: "This account is not allowed to open the church Drive setlist." }, { status: 403 });
  }

  try {
    const { file, content } = await downloadSetlistFromDrive();
    const migrated = migratePersistedState(content);
    if (!migrated.ok) {
      return NextResponse.json({ error: migrated.message }, { status: 422 });
    }
    return NextResponse.json({
      ok: true,
      state: migrated.state,
      file: { id: file.id, name: file.name, modifiedTime: file.modifiedTime ?? null },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The setlist could not be opened from Google Drive." },
      { status: 502 },
    );
  }
}

