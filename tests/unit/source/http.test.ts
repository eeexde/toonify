import { describe, expect, test, vi } from "vitest";
import { createFetchJson } from "@/lib/source/http";
import { TokenBucket } from "@/lib/ratelimit";
import { NotFoundError, UpstreamError } from "@/lib/source/errors";

const bucket = () => new TokenBucket({ capacity: 10, refillPerSec: 10 });

describe("fetchJson", () => {
  test("returns parsed json and sends headers", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"a":1}', { status: 200 }));
    const fj = createFetchJson({ fetch, headers: { "User-Agent": "ua" } });
    expect(await fj("https://x/y", bucket())).toEqual({ a: 1 });
    expect(fetch.mock.calls[0][1].headers["User-Agent"]).toBe("ua");
  });
  test("404 -> NotFoundError", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(createFetchJson({ fetch })("https://x", bucket())).rejects.toThrow(NotFoundError);
  });
  test("429 pauses bucket using Retry-After", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 429, headers: { "Retry-After": "7" } }));
    const b = bucket();
    const spy = vi.spyOn(b, "pauseFor");
    await expect(createFetchJson({ fetch })("https://x", b)).rejects.toThrow(UpstreamError);
    expect(spy).toHaveBeenCalledWith(7000);
  });
  test("timeout -> UpstreamError", async () => {
    const fetch = vi.fn((_u: string, init: RequestInit) =>
      new Promise<Response>((_, rej) => init.signal!.addEventListener("abort", () => rej(new DOMException("t", "TimeoutError")))),
    );
    await expect(createFetchJson({ fetch: fetch as never, timeoutMs: 20 })("https://x", bucket())).rejects.toThrow(UpstreamError);
  });
  test("invalid json -> UpstreamError", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(createFetchJson({ fetch })("https://x", bucket())).rejects.toThrow(UpstreamError);
  });
});
