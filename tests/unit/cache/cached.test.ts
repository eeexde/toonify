import { describe, expect, test, vi } from "vitest";
import { createCache } from "@/lib/cache/cached";
import { MemoryLRUStore } from "@/lib/cache/memory";

const policy = { fresh: 10, stale: 100 };
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  let t = 0;
  const now = () => t;
  const store = new MemoryLRUStore(100, now);
  const cache = createCache(store, { now });
  return { cache, store, advance: (s: number) => (t += s * 1000) };
}

describe("cached", () => {
  test("miss calls fn and stores", async () => {
    const { cache } = setup();
    const fn = vi.fn().mockResolvedValue(1);
    expect(await cache.cached("k", policy, fn)).toEqual({ value: 1, stale: false });
    expect(await cache.cached("k", policy, fn)).toEqual({ value: 1, stale: false });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("coalesces concurrent misses", async () => {
    const { cache } = setup();
    let resolve!: (v: number) => void;
    const fn = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const a = cache.cached("k", policy, fn);
    const b = cache.cached("k", policy, fn);
    await flush();
    resolve(7);
    expect((await a).value).toBe(7);
    expect((await b).value).toBe(7);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("stale entry served immediately and refreshed in background", async () => {
    const { cache, advance } = setup();
    await cache.cached("k", policy, async () => 1);
    advance(11);
    const fn = vi.fn().mockResolvedValue(2);
    expect(await cache.cached("k", policy, fn)).toEqual({ value: 1, stale: false });
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await cache.cached("k", policy, fn)).toEqual({ value: 2, stale: false });
  });

  test("marks stale after a failed refresh", async () => {
    const { cache, advance } = setup();
    await cache.cached("k", policy, async () => 1);
    advance(11);
    const failing = vi.fn().mockRejectedValue(new Error("down"));
    await cache.cached("k", policy, failing);
    await flush();
    expect(await cache.cached("k", policy, failing)).toEqual({ value: 1, stale: true });
  });

  test("miss with error throws and does not cache", async () => {
    const { cache } = setup();
    await expect(cache.cached("k", policy, async () => { throw new Error("x"); })).rejects.toThrow("x");
    const fn = vi.fn().mockResolvedValue(3);
    expect((await cache.cached("k", policy, fn)).value).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("entry gone after fresh+stale", async () => {
    const { cache, advance } = setup();
    await cache.cached("k", policy, async () => 1);
    advance(111);
    const fn = vi.fn().mockResolvedValue(2);
    expect((await cache.cached("k", policy, fn)).value).toBe(2);
  });

  test("invalidate removes entry", async () => {
    const { cache } = setup();
    await cache.cached("k", policy, async () => 1);
    await cache.invalidate("k");
    expect((await cache.cached("k", policy, async () => 5)).value).toBe(5);
  });
});
