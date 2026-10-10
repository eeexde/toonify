import { describe, expect, test, vi } from "vitest";
import { SourceService } from "@/lib/source/service";
import { createCache } from "@/lib/cache/cached";
import { MemoryLRUStore } from "@/lib/cache/memory";
import { MockSource } from "@/lib/source/mock";
import { InvalidIdError } from "@/lib/source/errors";

function svc() {
  const mock = new MockSource();
  const spy = vi.spyOn(mock, "title");
  const s = new SourceService({ sources: { mock }, cache: createCache(new MemoryLRUStore()), defaultSource: "mock" });
  return { s, spy };
}

describe("SourceService", () => {
  test("routes by prefix and caches", async () => {
    const { s, spy } = svc();
    expect((await s.title("mock:alpha")).value.title).toBe("Skyward Blade");
    await s.title("mock:alpha");
    expect(spy).toHaveBeenCalledTimes(1);
  });
  test("disabled source -> InvalidIdError", async () => {
    const { s } = svc();
    await expect(s.title("md:abc")).rejects.toThrow(InvalidIdError);
  });
  test("search key normalizes query", async () => {
    const { s } = svc();
    const a = await s.search("  Bakery ", 1, false);
    expect(a.value.items).toHaveLength(1);
  });
  test("list endpoints fall back to default when requested source is disabled", async () => {
    const { s } = svc();
    expect((await s.home(1, false, "md")).value.items.map((i) => i.id)).toEqual(["mock:alpha", "mock:beta"]);
    expect((await s.search("bakery", 1, false, "sg")).value.items).toHaveLength(1);
  });
  test("filters are part of the cache key and reach the source", async () => {
    const mock = new MockSource();
    const home = vi.spyOn(mock, "home");
    const s = new SourceService({ sources: { mock }, cache: createCache(new MemoryLRUStore()), defaultSource: "mock" });
    await s.home(1, true, undefined, { tags: ["fantasy"] });
    await s.home(1, true, undefined, { tags: ["fantasy"] });
    const r = await s.home(1, true, undefined, { tags: ["romance"] });
    expect(home).toHaveBeenCalledTimes(2);
    expect(home).toHaveBeenLastCalledWith(1, { mature: true, tags: ["romance"] });
    expect(r.value.items.map((i) => i.id)).toEqual(["mock:gamma"]);
  });
  test("tags: cached per source; sources without tags -> []", async () => {
    const mock = new MockSource();
    const tags = vi.spyOn(mock, "tags");
    const sg = { home: vi.fn(), search: vi.fn(), title: vi.fn(), chapter: vi.fn() };
    const s = new SourceService({ sources: { mock, sg }, cache: createCache(new MemoryLRUStore()), defaultSource: "mock" });
    expect((await s.tags()).value.length).toBe(4);
    await s.tags();
    expect(tags).toHaveBeenCalledTimes(1);
    expect((await s.tags("sg")).value).toEqual([]);
  });
  test("featured: cached per source and mature flag; [] for sources without it", async () => {
    const mock = new MockSource();
    const featured = vi.spyOn(mock, "featured");
    const sg = { home: vi.fn(), search: vi.fn(), title: vi.fn(), chapter: vi.fn() };
    const s = new SourceService({ sources: { mock, sg }, cache: createCache(new MemoryLRUStore()), defaultSource: "mock" });
    expect((await s.featured(false)).value).toHaveLength(2);
    await s.featured(false);
    expect((await s.featured(true)).value).toHaveLength(3);
    expect(featured).toHaveBeenCalledTimes(2);
    expect((await s.featured(false, "sg")).value).toEqual([]);
  });
  test("enabledSources", () => {
    expect(svc().s.enabledSources()).toEqual(["mock"]);
  });
  test("mdAtHome refresh only invalidates when the cached baseUrl is the one that failed", async () => {
    const CID = "1c65098a-7a6e-465b-8733-9d19fae27926";
    const A = { baseUrl: "https://a.mangadex.network", hash: "h", files: ["1-a.jpg"] };
    const B = { ...A, baseUrl: "https://b.mangadex.network" };
    const atHome = vi.fn().mockResolvedValueOnce(A).mockResolvedValueOnce(B);
    const md = { atHome } as unknown as import("@/lib/source/mangadex").MangaDexSource;
    const s = new SourceService({ sources: { md }, cache: createCache(new MemoryLRUStore()), defaultSource: "md" });
    expect((await s.mdAtHome(CID)).baseUrl).toBe(A.baseUrl);
    expect((await s.mdAtHome(CID, "https://other.mangadex.network")).baseUrl).toBe(A.baseUrl);
    expect(atHome).toHaveBeenCalledTimes(1);
    expect((await s.mdAtHome(CID, A.baseUrl)).baseUrl).toBe(B.baseUrl);
    expect((await s.mdAtHome(CID, A.baseUrl)).baseUrl).toBe(B.baseUrl);
    expect(atHome).toHaveBeenCalledTimes(2);
  });
  test("md chapter reuses the at-home cache (chapter + image lookup -> 1 upstream call)", async () => {
    const MID = "a96676e5-8ae2-425e-b549-7f15dd34a6d8";
    const CID = "1c65098a-7a6e-465b-8733-9d19fae27926";
    const atHome = vi.fn().mockResolvedValue({ baseUrl: "https://x.mangadex.network", hash: "h", files: ["1-a.jpg"] });
    const chapter = vi.fn();
    const md = { atHome, chapter } as unknown as import("@/lib/source/mangadex").MangaDexSource;
    const s = new SourceService({ sources: { md }, cache: createCache(new MemoryLRUStore()), defaultSource: "md" });
    const r = await s.chapter(`md:${MID}`, CID);
    expect(r.value.pages).toEqual([`/api/img/md/${CID}/1-a.jpg`]);
    await s.mdAtHome(CID);
    expect(atHome).toHaveBeenCalledTimes(1);
    expect(chapter).not.toHaveBeenCalled();
    await expect(s.chapter("md:nope", CID)).rejects.toThrow(InvalidIdError);
  });
});
