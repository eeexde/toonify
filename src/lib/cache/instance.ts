import { MemoryLRUStore } from "./memory";
import type { CacheStore } from "./store";
import { UpstashStore } from "./upstash";

let store: CacheStore | undefined;

export function getCacheStore(): CacheStore {
  if (!store) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    store = url && token ? new UpstashStore(url, token) : new MemoryLRUStore(500);
  }
  return store;
}
