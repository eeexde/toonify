import { Redis } from "@upstash/redis";
import type { CacheEntry, CacheStore } from "./store";

export class UpstashStore implements CacheStore {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const v = await this.redis.get<CacheEntry<T>>(key);
    return v ?? undefined;
  }

  async set<T>(key: string, entry: CacheEntry<T>, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, entry, { ex: Math.max(1, Math.ceil(ttlSeconds)) });
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
