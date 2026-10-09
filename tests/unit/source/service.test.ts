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
  test("enabledSources", () => {
    expect(svc().s.enabledSources()).toEqual(["mock"]);
  });
});
