import type { TokenBucket } from "../ratelimit";
import { NotFoundError, UpstreamError } from "./errors";

export type FetchJson = (url: string, bucket: TokenBucket) => Promise<unknown>;

export function userAgent(): string {
  return `toonify/0.1 (+${process.env.APP_URL ?? "http://localhost:3000"})`;
}

export function createFetchJson(
  o: { fetch?: typeof fetch; headers?: Record<string, string>; timeoutMs?: number } = {},
): FetchJson {
  const doFetch = o.fetch ?? fetch;
  const timeoutMs = o.timeoutMs ?? 10_000;
  return async (url, bucket) => {
    await bucket.take();
    let res: Response;
    try {
      res = await doFetch(url, {
        headers: { Accept: "application/json", ...o.headers },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (err) {
      throw new UpstreamError(`Upstream request failed: ${(err as Error).message}`);
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 5;
      bucket.pauseFor(retryAfter * 1000);
      throw new UpstreamError("Upstream rate limited", 429);
    }
    if (res.status === 404) throw new NotFoundError();
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new UpstreamError(`Upstream returned invalid JSON (${res.status})`, res.status);
    }
    if (!res.ok) {
      const err = new UpstreamError(`Upstream error ${res.status}`, res.status);
      (err as UpstreamError & { body?: unknown }).body = body;
      throw err;
    }
    return body;
  };
}
