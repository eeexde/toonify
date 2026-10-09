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
