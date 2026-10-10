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
  test("malformed percent-encoding -> 400", async () => {
    const ch = await import("@/app/api/chapter/[titleId]/[chapterId]/route");
    expect((await ch.GET(req("/x"), { params: Promise.resolve({ titleId: "mock:alpha", chapterId: "%E0%A4%A" }) })).status).toBe(400);
    const img = await import("@/app/api/img/[...path]/route");
    expect((await img.GET(req("/x"), { params: Promise.resolve({ path: ["md", "%E0%A4%A", "a.jpg"] }) })).status).toBe(400);
    const ti = await import("@/app/api/title/[titleId]/route");
    expect((await ti.GET(req("/x"), { params: Promise.resolve({ titleId: "%E0%A4%A" }) })).status).toBe(400);
  });
  test("title id is decoded exactly once", async () => {
    const { GET } = await import("@/app/api/title/[titleId]/route");
    // "%253A" decodes once to "%3A", which is not a valid prefixed id
    expect((await GET(req("/x"), { params: Promise.resolve({ titleId: "mock%253Aalpha" }) })).status).toBe(400);
  });
  test("upstream failure -> 502", async () => {
    vi.spyOn(MockSource.prototype, "home").mockRejectedValueOnce(new (await import("@/lib/source/errors")).UpstreamError("down"));
    const { GET } = await import("@/app/api/home/route");
    const res = await GET(req("/api/home?page=1"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Source unavailable" });
  });
  test("home applies filters from query params", async () => {
    const { GET } = await import("@/app/api/home/route");
    const res = await GET(req("/api/home?page=1&mature=1&tags=fantasy&sort=title"));
    expect((await res.json()).data.items.map((i: { id: string }) => i.id)).toEqual(["mock:alpha"]);
  });
  test("invalid filters -> 400", async () => {
    const { GET } = await import("@/app/api/home/route");
    expect((await GET(req("/api/home?sort=popular"))).status).toBe(400);
    const s = await import("@/app/api/search/route");
    expect((await s.GET(req("/api/search?q=moon&rating=nsfw"))).status).toBe(400);
  });
  test("tags route", async () => {
    const { GET } = await import("@/app/api/tags/route");
    const res = await GET(req("/api/tags"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.map((t: { id: string }) => t.id)).toContain("fantasy");
    expect((await GET(req("/api/tags?source=zz"))).status).toBe(400);
  });
  test("featured route", async () => {
    const { GET } = await import("@/app/api/featured/route");
    const res = await GET(req("/api/featured?mature=0"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=");
    expect((await res.json()).data.map((i: { id: string }) => i.id)).toEqual(["mock:alpha", "mock:beta"]);
    expect((await GET(req("/api/featured?source=zz"))).status).toBe(400);
  });
});
