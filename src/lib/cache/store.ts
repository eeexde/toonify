export interface CacheEntry<T> {
  value: T;
  storedAt: number;
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | undefined>;
  set<T>(key: string, entry: CacheEntry<T>, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}
