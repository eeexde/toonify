import { describe, expect, test } from "vitest";
import { checkLimit, clientKey, CLIENT_LIMITS, MemoryCounter, type WindowCounter } from "@/lib/client-limit";

describe("checkLimit", () => {
  test("allows up to the limit, then refuses", async () => {
    const now = () => 0;
    const c = new MemoryCounter(now);
    const { limit } = CLIENT_LIMITS.api;
    for (let i = 0; i < limit; i++) expect((await checkLimit(c, "api", "1.2.3.4", now)).ok).toBe(true);
    const r = await checkLimit(c, "api", "1.2.3.4", now);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetSec).toBe(CLIENT_LIMITS.api.windowSec);
  });

  test("counts clients and buckets separately", async () => {
    const now = () => 0;
    const c = new MemoryCounter(now);
    for (let i = 0; i < CLIENT_LIMITS.api.limit; i++) await checkLimit(c, "api", "a", now);
    expect((await checkLimit(c, "api", "a", now)).ok).toBe(false);
    expect((await checkLimit(c, "api", "b", now)).ok).toBe(true);
    expect((await checkLimit(c, "img", "a", now)).ok).toBe(true);
  });

  test("a new window resets the count", async () => {
    let t = 0;
    const now = () => t;
    const c = new MemoryCounter(now);
    for (let i = 0; i <= CLIENT_LIMITS.api.limit; i++) await checkLimit(c, "api", "a", now);
    expect((await checkLimit(c, "api", "a", now)).ok).toBe(false);
    t = CLIENT_LIMITS.api.windowSec * 1000;
    expect((await checkLimit(c, "api", "a", now)).ok).toBe(true);
  });

  test("fails open when the counter throws", async () => {
    const broken: WindowCounter = { incr: async () => { throw new Error("down"); } };
    expect((await checkLimit(broken, "api", "a")).ok).toBe(true);
  });
});

describe("clientKey", () => {
  test("prefers x-real-ip, then the first x-forwarded-for hop", () => {
    expect(clientKey(new Headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientKey(new Headers({ "x-forwarded-for": " 1.1.1.1 , 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
