import { NextResponse } from "next/server";

import { deploySetlistToDrive, readDriveServiceAccountConfig } from "@/lib/google-drive/service-account";
import { migratePersistedState } from "@/lib/storage/schema";

export const runtime = "nodejs";

async function authenticatedUserId(authorization: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://mmoizwtjnpfmowoqpmfa.supabase.co";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_oiTCgL6_m7RvLKVrwOdp7A_Ojp1zjSa";
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: publishableKey },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return user.id ?? null;
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const userId = authorization.startsWith("Bearer ") ? await authenticatedUserId(authorization) : null;
  if (!userId) {
    return NextResponse.json({ error: "Sign in again before deploying." }, { status: 401 });
  }
  const deployUsers = (process.env.GOOGLE_DRIVE_DEPLOY_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (deployUsers.length === 0) {
    return NextResponse.json({ error: "Google Drive deploy has no authorized users yet." }, { status: 503 });
  }
  if (!deployUsers.includes(userId)) {
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
