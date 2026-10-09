import { describe, expect, test } from "vitest";
import { TokenBucket } from "@/lib/ratelimit";
import { RateLimitedError } from "@/lib/source/errors";

function clock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms; },
    get t() { return t; },
  };
}

describe("TokenBucket", () => {
  test("allows burst up to capacity without waiting", async () => {
    const c = clock();
    const b = new TokenBucket({ capacity: 3, refillPerSec: 1, now: c.now, sleep: c.sleep });
    await b.take(); await b.take(); await b.take();
    expect(c.t).toBe(0);
  });
  test("waits for refill", async () => {
    const c = clock();
    const b = new TokenBucket({ capacity: 1, refillPerSec: 2, now: c.now, sleep: c.sleep });
    await b.take();
    await b.take();
    expect(c.t).toBe(500);
  });
  test("throws when wait exceeds maxWaitMs", async () => {
    const c = clock();
    const b = new TokenBucket({ capacity: 1, refillPerSec: 0.1, maxWaitMs: 3000, now: c.now, sleep: c.sleep });
    await b.take();
    await expect(b.take()).rejects.toThrow(RateLimitedError);
  });
  test("pauseFor blocks until pause ends", async () => {
    const c = clock();
    const b = new TokenBucket({ capacity: 5, refillPerSec: 5, now: c.now, sleep: c.sleep });
    b.pauseFor(2000);
    await b.take();
    expect(c.t).toBe(2000);
  });
});
