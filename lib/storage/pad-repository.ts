import type { PitchClass } from "@/lib/music/pitch";
import type { PadPreset } from "@/types/pads";

export type StoredLocalPadPack = {
  id: string;
  preset: PadPreset;
  pads: { pitchClass: PitchClass; data: ArrayBuffer }[];
};

const DB_NAME = "worship-keys";
const DB_VERSION = 2;
const STATE_STORE = "state";
const PAD_STORE = "local-pads";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
      if (!db.objectStoreNames.contains(PAD_STORE)) db.createObjectStore(PAD_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local pad storage could not be opened."));
  });
}

export async function loadLocalPadPacks(): Promise<StoredLocalPadPack[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDatabase();
  try {
    return await new Promise<StoredLocalPadPack[]>((resolve, reject) => {
      const request = db.transaction(PAD_STORE, "readonly").objectStore(PAD_STORE).getAll();
      request.onsuccess = () => resolve(request.result as StoredLocalPadPack[]);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveLocalPadPack(pack: StoredLocalPadPack): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PAD_STORE, "readwrite");
      transaction.objectStore(PAD_STORE).put(pack);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function removeLocalPadPack(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PAD_STORE, "readwrite");
      transaction.objectStore(PAD_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
