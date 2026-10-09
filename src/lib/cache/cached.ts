import type { CacheStore } from "./store";

export interface CachePolicy {
  fresh: number;
  stale: number;
}

export interface CachedResult<T> {
  value: T;
  stale: boolean;
}

export type Defer = (p: Promise<unknown>) => void;

export interface CacheApi {
  cached<T>(key: string, policy: CachePolicy, fn: () => Promise<T>): Promise<CachedResult<T>>;
  invalidate(key: string): Promise<void>;
}

export function createCache(
  store: CacheStore,
  opts: { now?: () => number; defer?: Defer } = {},
): CacheApi {
  const now = opts.now ?? (() => Date.now());
  const defer: Defer = opts.defer ?? ((p) => void p);
  const inflight = new Map<string, Promise<unknown>>();
  const failed = new Set<string>();

  function run<T>(key: string, policy: CachePolicy, fn: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key);
    if (existing) return existing as Promise<T>;
    const p = (async () => {
      try {
        const value = await fn();
        await store.set(key, { value, storedAt: now() }, policy.fresh + policy.stale);
        failed.delete(key);
        return value;
      } catch (err) {
        failed.add(key);
        throw err;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, p);
    return p;
  }

  return {
    async cached<T>(key: string, policy: CachePolicy, fn: () => Promise<T>) {
      let entry: Awaited<ReturnType<CacheStore["get"]>> | undefined;
      try {
        entry = await store.get<T>(key);
      } catch (err) {
        console.error("[cache] get failed", key, err);
      }
      if (entry) {
        const ageSeconds = (now() - entry.storedAt) / 1000;
        if (ageSeconds < policy.fresh) return { value: entry.value as T, stale: false };
        const stale = failed.has(key);
        defer(run(key, policy, fn).catch((err) => console.warn("[cache] refresh failed", key, err)));
        return { value: entry.value as T, stale };
      }
      return { value: await run(key, policy, fn), stale: false };
    },
    async invalidate(key: string) {
      await store.delete(key);
    },
  };
}
