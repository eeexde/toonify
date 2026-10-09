import type { CacheEntry, CacheStore } from "./store";

interface Slot {
  entry: CacheEntry<unknown>;
  expiresAt: number;
}

export class MemoryLRUStore implements CacheStore {
  private map = new Map<string, Slot>();

  constructor(
    private maxEntries = 500,
    private now: () => number = () => Date.now(),
  ) {}

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const slot = this.map.get(key);
    if (!slot) return undefined;
    if (this.now() > slot.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, slot);
    return slot.entry as CacheEntry<T>;
  }

  async set<T>(key: string, entry: CacheEntry<T>, ttlSeconds: number): Promise<void> {
    this.map.delete(key);
    this.map.set(key, { entry, expiresAt: this.now() + ttlSeconds * 1000 });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}
