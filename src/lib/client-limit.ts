import { Redis } from "@upstash/redis";

/** Fixed-window per-client limits. Images get more room: a chapter alone is dozens of requests. */
export const CLIENT_LIMITS = {
  api: { limit: 120, windowSec: 60 },
  img: { limit: 900, windowSec: 60 },
} as const;

export type LimitBucket = keyof typeof CLIENT_LIMITS;

export interface LimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window ends. */
  resetSec: number;
}

export interface WindowCounter {
  /** Increments the key's count for the window and returns the new count. */
  incr(key: string, windowSec: number): Promise<number>;
}

/** Per-instance fallback; on serverless each instance counts on its own. */
export class MemoryCounter implements WindowCounter {
  private counts = new Map<string, number>();
  private window = -1;

  constructor(private now: () => number = () => Date.now(), private maxKeys = 10_000) {}

  async incr(key: string, windowSec: number): Promise<number> {
    const w = Math.floor(this.now() / 1000 / windowSec);
    if (w !== this.window || this.counts.size >= this.maxKeys) {
      this.counts.clear();
      this.window = w;
    }
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return n;
  }
}

export class UpstashCounter implements WindowCounter {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async incr(key: string, windowSec: number): Promise<number> {
    const [n] = await this.redis.pipeline().incr(key).expire(key, windowSec, "NX").exec<[number, number]>();
    return n;
  }
}

export async function checkLimit(
  counter: WindowCounter,
  bucket: LimitBucket,
  client: string,
  now: () => number = () => Date.now(),
): Promise<LimitResult> {
  const { limit, windowSec } = CLIENT_LIMITS[bucket];
  const t = now() / 1000;
  const window = Math.floor(t / windowSec);
  const resetSec = Math.max(1, Math.ceil((window + 1) * windowSec - t));
  let n: number;
  try {
    n = await counter.incr(`rl:${bucket}:${window}:${client}`, windowSec);
  } catch (err) {
    // A cache outage must not take the whole API down with it.
    console.error("[ratelimit] counter failed", err);
    return { ok: true, limit, remaining: limit, resetSec };
  }
  return { ok: n <= limit, limit, remaining: Math.max(0, limit - n), resetSec };
}

/** Best-effort client address. Trusts the platform proxy headers (Vercel sets x-real-ip). */
export function clientKey(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || "unknown";
}
