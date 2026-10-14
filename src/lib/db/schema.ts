import Dexie, { type Table } from "dexie";
import { indexedDB as memIDB, IDBKeyRange as memRange } from "fake-indexeddb";
import type { HistoryItem, LibraryItem, ProgressItem, SettingRow, TitlePref } from "./types";

export class ToonifyDB extends Dexie {
  library!: Table<LibraryItem, string>;
  history!: Table<HistoryItem, string>;
  progress!: Table<ProgressItem, [string, string]>;
  settings!: Table<SettingRow, string>;
  titlePrefs!: Table<TitlePref, string>;

  constructor(name: string, options?: ConstructorParameters<typeof Dexie>[1]) {
    super(name, options);
    this.version(1).stores({
      library: "titleId, addedAt",
      history: "titleId, readAt",
      progress: "[titleId+chapterId], titleId, updatedAt",
      settings: "key",
    });
    this.version(2).stores({ titlePrefs: "titleId" });
  }
}

export let storageDegraded = false;

export function createDb(name = "toonify"): ToonifyDB {
  return new ToonifyDB(name);
}

function createBrowserDb(): ToonifyDB {
  if (typeof indexedDB !== "undefined") return createDb();
  // No IndexedDB (SSR or locked-down browser): in-memory fallback.
  storageDegraded = typeof window !== "undefined";
  return new ToonifyDB("toonify", { indexedDB: memIDB, IDBKeyRange: memRange });
}

export const db = createBrowserDb();
