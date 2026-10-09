import { afterEach, describe, expect, test, vi } from "vitest";
import { api, ApiError } from "@/lib/query/fetcher";
import { staleStore } from "@/lib/query/stale-store";

afterEach(() => vi.unstubAllGlobals());

describe("api fetcher", () => {
  test("unwraps data and records stale", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { a: 1 }, stale: true }))));
    expect(await api("/api/x")).toEqual({ a: 1 });
    expect(staleStore.get()).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: 1, stale: false }))));
    await api("/api/x");
    expect(staleStore.get()).toBe(false);
  });
  test("throws ApiError with status and message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Not found" }), { status: 404 })));
    await expect(api("/api/x")).rejects.toMatchObject({ status: 404, message: "Not found" });
    await expect(api("/api/x")).rejects.toBeInstanceOf(ApiError);
  });
  test("network failure -> status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(api("/api/x")).rejects.toMatchObject({ status: 0 });
  });
});
