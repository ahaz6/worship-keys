import { createSign } from "node:crypto";

import type { PersistedState } from "@/lib/storage/schema";
import { toExportJson } from "@/lib/storage/setlist-repository";

export const DRIVE_CURRENT_FILE = "Worship Keys Current.worship-keys.json";
export const DEFAULT_DRIVE_FOLDER_ID = "1pD8L0WbTM-i_HdhGT13vM3kbNDVWVcpB";

export type DriveFile = {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
};

type ServiceAccountConfig = {
  clientEmail: string;
  privateKey: string;
  folderId: string;
  fileId?: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export function readDriveServiceAccountConfig(): ServiceAccountConfig | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || DEFAULT_DRIVE_FOLDER_ID;
  const fileId = process.env.GOOGLE_DRIVE_FILE_ID?.trim() || undefined;
  return clientEmail && privateKey ? { clientEmail, privateKey, folderId, fileId } : null;
}

async function getAccessToken(config: ServiceAccountConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).end().sign(config.privateKey, "base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  const result = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || "Google Drive authorization failed.");
  }
  cachedToken = {
    value: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
  return result.access_token;
}

async function driveRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || `Google Drive returned ${response.status}.`);
  return result;
}

async function findCurrentDriveFile(token: string, config: ServiceAccountConfig): Promise<DriveFile | null> {
  if (config.fileId) {
    const fields = encodeURIComponent("id,name,webViewLink,modifiedTime");
    return driveRequest<DriveFile>(
      token,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(config.fileId)}?supportsAllDrives=true&fields=${fields}`,
    );
  }

  const escapedName = DRIVE_CURRENT_FILE.replaceAll("'", "\\'");
  const query = `'${config.folderId}' in parents and name = '${escapedName}' and trashed = false`;
  const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("fields", "files(id,name,webViewLink,modifiedTime)");
  listUrl.searchParams.set("spaces", "drive");
  listUrl.searchParams.set("supportsAllDrives", "true");
  listUrl.searchParams.set("includeItemsFromAllDrives", "true");
  const listed = await driveRequest<{ files?: DriveFile[] }>(token, listUrl.toString());
  return listed.files?.[0] ?? null;
}

/** Downloads the single current church setlist shared with the service account. */
export async function downloadSetlistFromDrive(): Promise<{ file: DriveFile; content: unknown }> {
  const config = readDriveServiceAccountConfig();
  if (!config) throw new Error("Google Drive access is not configured on Vercel yet.");
  const token = await getAccessToken(config);
  const file = await findCurrentDriveFile(token, config);
  if (!file) throw new Error(`${DRIVE_CURRENT_FILE} was not found in Google Drive.`);
  const content = await driveRequest<unknown>(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`,
  );
  return { file, content };
}

export async function deploySetlistToDrive(state: PersistedState): Promise<DriveFile> {
  const config = readDriveServiceAccountConfig();
  if (!config) throw new Error("Google Drive deploy is not configured on Vercel yet.");
  const token = await getAccessToken(config);
  const content = toExportJson(state);
  const fields = encodeURIComponent("id,name,webViewLink,modifiedTime");

  if (config.fileId) {
    return driveRequest<DriveFile>(
      token,
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(config.fileId)}?uploadType=media&supportsAllDrives=true&fields=${fields}`,
      { method: "PATCH", headers: { "Content-Type": "application/json; charset=utf-8" }, body: content },
    );
  }

  const existing = await findCurrentDriveFile(token, config);
  if (existing) {
    return driveRequest<DriveFile>(
      token,
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media&supportsAllDrives=true&fields=${fields}`,
      { method: "PATCH", headers: { "Content-Type": "application/json; charset=utf-8" }, body: content },
    );
  }

  const boundary = `worship-keys-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: DRIVE_CURRENT_FILE,
    mimeType: "application/json",
    parents: [config.folderId],
  });
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n`,
    `--${boundary}--`,
  ].join("");
  return driveRequest<DriveFile>(
    token,
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=${fields}`,
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
  );
}
