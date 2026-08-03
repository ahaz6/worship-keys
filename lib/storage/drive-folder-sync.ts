import { migratePersistedState, type PersistedState } from "./schema";
import { toExportJson } from "./setlist-repository";

const DB_NAME = "worship-keys-drive-sync";
const STORE = "handles";
const HANDLE_KEY = "worship-keys-sets";
export const DRIVE_CURRENT_FILE = "Worship Keys Current.worship-keys.json";

type PermissionStateLike = "granted" | "denied" | "prompt";
type DirectoryHandleLike = {
  name: string;
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionStateLike>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionStateLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    getFile(): Promise<File>;
    createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  }>;
};

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Drive folder access could not be stored."));
  });
}

async function storeHandle(handle: DirectoryHandleLike): Promise<void> {
  const db = await openHandleDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(handle, HANDLE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadDriveFolderHandle(): Promise<DirectoryHandleLike | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openHandleDatabase();
  const handle = await new Promise<DirectoryHandleLike | null>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as DirectoryHandleLike | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return handle;
}

export function supportsDriveFolderSync(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function chooseDriveFolder(): Promise<DirectoryHandleLike> {
  const picker = (window as unknown as Window & {
    showDirectoryPicker: (options: { id: string; mode: "readwrite" }) => Promise<DirectoryHandleLike>;
  }).showDirectoryPicker;
  if (!picker) throw new Error("Folder sync requires Chrome or Edge on desktop.");
  const handle = await picker({ id: HANDLE_KEY, mode: "readwrite" });
  await storeHandle(handle);
  return handle;
}

export async function ensureDrivePermission(handle: DirectoryHandleLike, request = false): Promise<boolean> {
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return request && (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

export async function writeStateToDrive(handle: DirectoryHandleLike, state: PersistedState): Promise<void> {
  const fileHandle = await handle.getFileHandle(DRIVE_CURRENT_FILE, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(toExportJson(state));
  await writable.close();
}

export async function readStateFromDrive(handle: DirectoryHandleLike): Promise<PersistedState> {
  const fileHandle = await handle.getFileHandle(DRIVE_CURRENT_FILE);
  const raw = JSON.parse(await (await fileHandle.getFile()).text());
  const migrated = migratePersistedState(raw);
  if (!migrated.ok) throw new Error(migrated.message);
  return migrated.state;
}
