import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { SourceService } from "@/lib/source/service";
import { createCache } from "@/lib/cache/cached";
import { MemoryLRUStore } from "@/lib/cache/memory";
import { MockSource } from "@/lib/source/mock";

let service: SourceService;
vi.mock("@/lib/source/service-instance", () => ({ getSourceService: () => service }));

beforeEach(() => {
  service = new SourceService({ sources: { mock: new MockSource() }, cache: createCache(new MemoryLRUStore()), defaultSource: "mock" });
});

const req = (path: string) => new NextRequest(`http://localhost${path}`);

describe("api routes", () => {
  test("home ok with cache headers", async () => {
    const { GET } = await import("@/app/api/home/route");
    const res = await GET(req("/api/home?page=1&mature=0"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=600, stale-while-revalidate=604800");
    const body = await res.json();
    expect(body.stale).toBe(false);
    expect(body.data.items).toHaveLength(2);
  });
  test("home rejects bad page", async () => {
    const { GET } = await import("@/app/api/home/route");
    expect((await GET(req("/api/home?page=0"))).status).toBe(400);
    expect((await GET(req("/api/home?page=abc"))).status).toBe(400);
  });
  test("search requires 2 chars", async () => {
    const { GET } = await import("@/app/api/search/route");
    expect((await GET(req("/api/search?q=a"))).status).toBe(400);
    expect((await GET(req("/api/search?q=" + encodeURIComponent("moon/lit #?")))).status).toBe(200);
  });
  test("title 404 and 400", async () => {
    const { GET } = await import("@/app/api/title/[titleId]/route");
    expect((await GET(req("/x"), { params: Promise.resolve({ titleId: "mock:nope" }) })).status).toBe(404);
    expect((await GET(req("/x"), { params: Promise.resolve({ titleId: "garbage" }) })).status).toBe(400);
    const ok = await GET(req("/x"), { params: Promise.resolve({ titleId: "mock%3Aalpha" }) });
    expect(ok.status).toBe(200);
  });
  test("chapter", async () => {
    const { GET } = await import("@/app/api/chapter/[titleId]/[chapterId]/route");
    const res = await GET(req("/x"), { params: Promise.resolve({ titleId: "mock:alpha", chapterId: "1" }) });
    expect((await res.json()).data.pages).toHaveLength(5);
  });
  test("upstream failure -> 502", async () => {
    vi.spyOn(MockSource.prototype, "home").mockRejectedValueOnce(new (await import("@/lib/source/errors")).UpstreamError("down"));
    const { GET } = await import("@/app/api/home/route");
    const res = await GET(req("/api/home?page=1"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Source unavailable" });
  });
});
