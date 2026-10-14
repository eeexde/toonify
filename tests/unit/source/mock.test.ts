import { describe, expect, test } from "vitest";
import { MockSource } from "@/lib/source/mock";
import { NotFoundError } from "@/lib/source/errors";
import { mockSvg } from "@/lib/img/mock-svg";

describe("MockSource", () => {
  const src = new MockSource();
  test("home hides mature unless enabled", async () => {
    expect((await src.home(1, { mature: false, kind: "manhwa" })).items.map((i) => i.id)).toEqual(["mock:alpha", "mock:beta"]);
    expect((await src.home(1, { mature: true, kind: "manhwa" })).items).toHaveLength(3);
  });
  test("search filters case-insensitively", async () => {
    expect((await src.search("BAKERY", 1, { mature: false, kind: "manhwa" })).items.map((i) => i.id)).toEqual(["mock:beta"]);
  });
  test("summaries carry series status", async () => {
    const items = (await src.home(1, { mature: false, kind: "manhwa" })).items;
    expect(items.map((i) => i.status)).toEqual(["ongoing", "completed"]);
  });
  test("filters by tag, rating and sorts by title", async () => {
    expect((await src.home(1, { mature: true, kind: "manhwa", tags: ["fantasy"] })).items.map((i) => i.id)).toEqual(["mock:alpha"]);
    expect((await src.home(1, { mature: true, kind: "manhwa", ratings: ["erotica"] })).items.map((i) => i.id)).toEqual(["mock:gamma"]);
    expect((await src.home(1, { mature: false, kind: "manhwa", ratings: ["erotica"] })).items).toEqual([]);
    expect((await src.home(1, { mature: true, kind: "manhwa", sort: "title" })).items.map((i) => i.title)).toEqual(["Crimson Night", "Moonlit Bakery", "Skyward Blade"]);
    expect((await src.search("a", 1, { mature: false, kind: "manhwa", sort: "title" })).items.map((i) => i.title)).toEqual(["Moonlit Bakery", "Skyward Blade"]);
  });
  test("tags derived from fixture genres", async () => {
    expect((await src.tags()).map((t) => t.id)).toEqual(["action", "drama", "fantasy", "romance", "slice-of-life"]);
  });
  test("featured: visible fixtures with synopsis and genres", async () => {
    const f = await src.featured({ mature: false, kind: "manhwa" });
    expect(f.map((i) => i.id)).toEqual(["mock:alpha", "mock:beta"]);
    expect(f[0]).toMatchObject({ title: "Skyward Blade", summary: "A swordsman climbs the tower.", genres: ["Action", "Fantasy"], status: "ongoing" });
    expect((await src.featured({ mature: true, kind: "manhwa" })).length).toBe(3);
  });
  test("title + chapter", async () => {
    const t = await src.title("alpha");
    expect(t.chapters.map((c) => c.id)).toEqual(["1", "2", "3", "4"]);
    expect(t.chapters[3].externalUrl).toBeDefined();
    const c = await src.chapter("alpha", "2");
    expect(c.pages).toEqual([1, 2, 3, 4, 5].map((n) => `/api/img/mock/page/alpha/2/${n}`));
  });
  test("unknown -> NotFoundError", async () => {
    await expect(src.title("zzz")).rejects.toThrow(NotFoundError);
    await expect(src.chapter("alpha", "4")).rejects.toThrow(NotFoundError);
  });
  test("defaults to the manga catalog", async () => {
    expect((await src.home(1, { mature: false })).items.map((i) => i.id)).toEqual(["mock:delta", "mock:epsilon"]);
    expect((await src.search("lantern", 1, { mature: false })).items.map((i) => i.id)).toEqual(["mock:delta"]);
    expect((await src.featured({ mature: false })).map((i) => i.id)).toEqual(["mock:delta", "mock:epsilon"]);
  });
  test("layout follows kind", async () => {
    expect((await src.title("delta")).layout).toBe("paged");
    expect((await src.title("alpha")).layout).toBe("strip");
  });
  test("svg", () => {
    expect(mockSvg("Hi <&>", 10)).toContain("Hi &lt;&amp;&gt;");
  });
});
