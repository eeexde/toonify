import { describe, expect, test } from "vitest";
import { effectiveRatings, filtersKey, filtersToSearch, parseFilters } from "@/lib/source/filters";

const sp = (s: string) => new URLSearchParams(s);

describe("parseFilters", () => {
  test("empty -> no filters", () => {
    expect(parseFilters(sp(""))).toEqual({});
  });
  test("parses sort, tags and ratings, normalized", () => {
    expect(parseFilters(sp("sort=title&tags=romance,action,action&rating=suggestive,safe"))).toEqual({
      sort: "title",
      tags: ["action", "romance"],
      ratings: ["safe", "suggestive"],
    });
  });
  test.each([
    ["sort=popular"],
    ["rating=nsfw"],
    ["tags=" + encodeURIComponent("../x")],
    ["tags=" + Array.from({ length: 11 }, (_, i) => `t${i}`).join(",")],
  ])("rejects %s", (q) => expect(parseFilters(sp(q))).toBeNull());
});

describe("effectiveRatings", () => {
  test("defaults to safe+suggestive, all four when mature", () => {
    expect(effectiveRatings(false)).toEqual(["safe", "suggestive"]);
    expect(effectiveRatings(true)).toEqual(["safe", "suggestive", "erotica", "pornographic"]);
  });
  test("selection is clipped by the mature setting", () => {
    expect(effectiveRatings(false, ["safe", "erotica"])).toEqual(["safe"]);
    expect(effectiveRatings(false, ["erotica"])).toEqual([]);
    expect(effectiveRatings(true, ["erotica"])).toEqual(["erotica"]);
  });
});

describe("filtersKey / filtersToSearch", () => {
  test("stable regardless of input order", () => {
    expect(filtersKey({ tags: ["b", "a"], ratings: ["suggestive", "safe"] })).toBe(filtersKey({ tags: ["a", "b"], ratings: ["safe", "suggestive"] }));
    expect(filtersKey({})).toBe("");
  });
  test("round trips through query params", () => {
    const f = { sort: "follows" as const, tags: ["action"], ratings: ["safe" as const] };
    expect(parseFilters(new URLSearchParams(filtersToSearch(f)))).toEqual(f);
    expect(filtersToSearch({})).toBe("");
  });
});
