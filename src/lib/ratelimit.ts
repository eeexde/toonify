import { RateLimitedError } from "./source/errors";

export class TokenBucket {
  private tokens: number;
  private last: number;
  private pausedUntil = 0;
  private capacity: number;
  private refillPerSec: number;
  private maxWaitMs: number;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;

  constructor(o: {
    capacity: number;
    refillPerSec: number;
    maxWaitMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  }) {
    this.capacity = o.capacity;
    this.refillPerSec = o.refillPerSec;
    this.maxWaitMs = o.maxWaitMs ?? 3000;
    this.now = o.now ?? (() => Date.now());
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.tokens = o.capacity;
    this.last = this.now();
  }

  private refill() {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.refillPerSec);
    this.last = t;
  }

  async take(): Promise<void> {
    const deadline = this.now() + this.maxWaitMs;
    for (;;) {
      this.refill();
      const t = this.now();
      if (t >= this.pausedUntil && this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitPause = Math.max(0, this.pausedUntil - t);
      const waitToken = this.tokens >= 1 ? 0 : ((1 - this.tokens) / this.refillPerSec) * 1000;
      const wait = Math.ceil(Math.max(waitPause, waitToken));
      if (t + wait > deadline) throw new RateLimitedError();
      await this.sleep(wait);
    }
  }

  pauseFor(ms: number) {
    this.pausedUntil = Math.max(this.pausedUntil, this.now() + ms);
  }
}
