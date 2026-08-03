import { NextResponse } from "next/server";

import { deploySetlistToDrive, readDriveServiceAccountConfig } from "@/lib/google-drive/service-account";
import { migratePersistedState } from "@/lib/storage/schema";
import { authenticatedUserId, canAccessDriveSetlist } from "@/lib/supabase/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const userId = await authenticatedUserId(authorization);
  if (!userId) {
    return NextResponse.json({ error: "Sign in again before deploying." }, { status: 401 });
  }
  if (!(process.env.GOOGLE_DRIVE_DEPLOY_USER_IDS ?? "").trim()) {
    return NextResponse.json({ error: "Google Drive deploy has no authorized users yet." }, { status: 503 });
  }
  if (!canAccessDriveSetlist(userId)) {
    return NextResponse.json({ error: "This account is not allowed to deploy the church setlist." }, { status: 403 });
  }
  if (!readDriveServiceAccountConfig()) {
    return NextResponse.json({ error: "Google Drive deploy is not configured on Vercel yet." }, { status: 503 });
  }

  const migrated = migratePersistedState(await request.json().catch(() => null));
  if (!migrated.ok) return NextResponse.json({ error: migrated.message }, { status: 400 });

  try {
    const file = await deploySetlistToDrive(migrated.state);
    return NextResponse.json({
      ok: true,
      file: {
        id: file.id,
        name: file.name,
        url: file.webViewLink ?? null,
        modifiedTime: file.modifiedTime ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The setlist could not be deployed to Google Drive." },
      { status: 502 },
    );
  }
}
