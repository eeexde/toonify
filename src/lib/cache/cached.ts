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

export const REFRESH_COOLDOWN_MS = 30_000;
const MAX_FAILED_KEYS = 1000;

export function createCache(
  store: CacheStore,
  opts: { now?: () => number; defer?: Defer } = {},
): CacheApi {
  const now = opts.now ?? (() => Date.now());
  const defer: Defer = opts.defer ?? ((p) => void p);
  // inflight and failed are per-process (not shared across serverless instances).
  const inflight = new Map<string, Promise<unknown>>();
  // key -> time (ms) of the most recent failed upstream call.
  const failed = new Map<string, number>();

  function markFailed(key: string) {
    failed.delete(key);
    failed.set(key, now());
    while (failed.size > MAX_FAILED_KEYS) {
      const oldest = failed.keys().next().value as string;
      failed.delete(oldest);
    }
  }

  function run<T>(key: string, policy: CachePolicy, fn: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key);
    if (existing) return existing as Promise<T>;
    // Deferring fn to a microtask guarantees the body never runs synchronously,
    // so inflight.set below always happens before the finally block.
    const p = (async () => {
      try {
        const value = await Promise.resolve().then(fn);
        failed.delete(key);
        try {
          await store.set(key, { value, storedAt: now() }, policy.fresh + policy.stale);
        } catch (err) {
          console.error("[cache] set failed", key, err);
        }
        return value;
      } catch (err) {
        markFailed(key);
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
        const failedAt = failed.get(key);
        const stale = failedAt !== undefined;
        if (failedAt === undefined || now() - failedAt >= REFRESH_COOLDOWN_MS) {
          defer(run(key, policy, fn).catch((err) => console.warn("[cache] refresh failed", key, err)));
        }
        return { value: entry.value as T, stale };
      }
      return { value: await run(key, policy, fn), stale: false };
    },
    async invalidate(key: string) {
      await store.delete(key);
    },
  };
}
