/**
 * Local persistence for setlists and preferences (spec 14.3).
 *
 * IndexedDB sits behind this interface so the rest of the app never touches it
 * directly, and so tests can swap in the in-memory implementation.
 */

import {
  CURRENT_SCHEMA_VERSION,
  type PersistedState,
  type Preferences,
  type Setlist,
  migratePersistedState,
  preferencesSchema,
} from "./schema";

export type LoadOutcome =
  | { status: "loaded"; state: PersistedState; notice: string | null }
  | { status: "empty" }
  | { status: "error"; message: string };

export interface SetlistRepository {
  load(): Promise<LoadOutcome>;
  save(state: PersistedState): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "worship-keys";
const DB_VERSION = 2;
const STORE = "state";
const PAD_STORE = "local-pads";
const STATE_KEY = "current";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(PAD_STORE)) db.createObjectStore(PAD_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
  });
}

export class IndexedDbSetlistRepository implements SetlistRepository {
  async load(): Promise<LoadOutcome> {
    if (typeof indexedDB === "undefined") {
      return { status: "error", message: "This browser has no local storage available for setlists." };
    }
    try {
      const db = await openDatabase();
      const raw = await new Promise<unknown>((resolve, reject) => {
        const request = db.transaction(STORE, "readonly").objectStore(STORE).get(STATE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();

      if (raw == null) return { status: "empty" };

      const migrated = migratePersistedState(raw);
      if (!migrated.ok) return { status: "error", message: migrated.message };
      return {
        status: "loaded",
        state: migrated.state,
        notice: migrated.migratedFrom == null ? null : "Your setlist was updated to the current format.",
      };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Setlist could not be loaded." };
    }
  }

  async save(state: PersistedState): Promise<void> {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(state, STATE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(STATE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }
}

/** Used by tests and as a fallback when IndexedDB is unavailable. */
export class InMemorySetlistRepository implements SetlistRepository {
  private stored: PersistedState | null = null;

  async load(): Promise<LoadOutcome> {
    if (!this.stored) return { status: "empty" };
    return { status: "loaded", state: this.stored, notice: null };
  }

  async save(state: PersistedState): Promise<void> {
    this.stored = structuredClone(state);
  }

  async clear(): Promise<void> {
    this.stored = null;
  }
}

export function createPersistedState(setlist: Setlist, preferences: Partial<Preferences> = {}): PersistedState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    setlist,
    preferences: preferencesSchema.parse(preferences),
  };
}

/** Export payload for the JSON export/import milestone. */
export function toExportJson(state: PersistedState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}
