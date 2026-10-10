import { describe, expect, test } from "vitest";
import { MockSource } from "@/lib/source/mock";
import { NotFoundError } from "@/lib/source/errors";
import { mockSvg } from "@/lib/img/mock-svg";

describe("MockSource", () => {
  const src = new MockSource();
  test("home hides mature unless enabled", async () => {
    expect((await src.home(1, { mature: false })).items.map((i) => i.id)).toEqual(["mock:alpha", "mock:beta"]);
    expect((await src.home(1, { mature: true })).items).toHaveLength(3);
  });
  test("search filters case-insensitively", async () => {
    expect((await src.search("BAKERY", 1, { mature: false })).items.map((i) => i.id)).toEqual(["mock:beta"]);
  });
  test("summaries carry series status", async () => {
    const items = (await src.home(1, { mature: false })).items;
    expect(items.map((i) => i.status)).toEqual(["ongoing", "completed"]);
  });
  test("filters by tag, rating and sorts by title", async () => {
    expect((await src.home(1, { mature: true, tags: ["fantasy"] })).items.map((i) => i.id)).toEqual(["mock:alpha"]);
    expect((await src.home(1, { mature: true, ratings: ["erotica"] })).items.map((i) => i.id)).toEqual(["mock:gamma"]);
    expect((await src.home(1, { mature: false, ratings: ["erotica"] })).items).toEqual([]);
    expect((await src.home(1, { mature: true, sort: "title" })).items.map((i) => i.title)).toEqual(["Crimson Night", "Moonlit Bakery", "Skyward Blade"]);
    expect((await src.search("a", 1, { mature: false, sort: "title" })).items.map((i) => i.title)).toEqual(["Moonlit Bakery", "Skyward Blade"]);
  });
  test("tags derived from fixture genres", async () => {
    expect((await src.tags()).map((t) => t.id)).toEqual(["action", "fantasy", "romance", "slice-of-life"]);
  });
  test("featured: visible fixtures with synopsis and genres", async () => {
    const f = await src.featured({ mature: false });
    expect(f.map((i) => i.id)).toEqual(["mock:alpha", "mock:beta"]);
    expect(f[0]).toMatchObject({ title: "Skyward Blade", summary: "A swordsman climbs the tower.", genres: ["Action", "Fantasy"], status: "ongoing" });
    expect((await src.featured({ mature: true })).length).toBe(3);
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
  test("svg", () => {
    expect(mockSvg("Hi <&>", 10)).toContain("Hi &lt;&amp;&gt;");
  });
});
