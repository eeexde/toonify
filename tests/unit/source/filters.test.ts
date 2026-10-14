import { describe, expect, test } from "vitest";
import {
  clearFilters,
  effectiveKind,
  effectiveRatings,
  filtersKey,
  filtersToSearch,
  hasFilters,
  parseFilters,
  sourceSupportsKind,
} from "@/lib/source/filters";

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

describe("kind", () => {
  test("defaults to manga; manga is normalised away, manhwa kept", () => {
    expect(effectiveKind({})).toBe("manga");
    expect(parseFilters(sp("kind=manga"))).toEqual({});
    expect(parseFilters(sp("kind=manhwa"))).toEqual({ kind: "manhwa" });
    expect(effectiveKind(parseFilters(sp("kind=manhwa"))!)).toBe("manhwa");
  });
  test("rejects unknown kind", () => {
    expect(parseFilters(sp("kind=manhua"))).toBeNull();
  });
  test("key and URL: only manhwa is written; round trips", () => {
    expect(filtersKey({})).toBe("");
    expect(filtersKey({ kind: "manga" })).toBe("");
    expect(filtersKey({ kind: "manhwa", sort: "title" })).toBe("s=title;k=manhwa");
    expect(filtersToSearch({ kind: "manhwa", tags: ["action"] })).toBe("kind=manhwa&tags=action");
    expect(filtersToSearch({ kind: "manga" })).toBe("");
    const f = { kind: "manhwa" as const, sort: "follows" as const };
    expect(parseFilters(new URLSearchParams(filtersToSearch(f)))).toEqual(f);
  });
  test("kind alone is not an active filter", () => {
    expect(hasFilters({ kind: "manhwa" })).toBe(false);
  });
  test("clearFilters keeps a non-default kind only", () => {
    expect(clearFilters({ kind: "manhwa", sort: "title", tags: ["a"], ratings: ["safe"] })).toEqual({ kind: "manhwa" });
    expect(clearFilters({ sort: "title" })).toEqual({});
  });
  test("ScraperGo is manhwa-only", () => {
    expect(sourceSupportsKind("sg", "manga")).toBe(false);
    expect(sourceSupportsKind("sg", "manhwa")).toBe(true);
    expect(sourceSupportsKind("md", "manga")).toBe(true);
    expect(sourceSupportsKind("mock", "manga")).toBe(true);
  });
});
