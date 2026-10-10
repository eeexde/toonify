import { describe, expect, test } from "vitest";
import { browseApiPath, browseHref, readBrowse } from "@/lib/query/browse";

describe("browse urls", () => {
  test("browseHref: home when empty, q + filters otherwise", () => {
    expect(browseHref("", {})).toBe("/");
    expect(browseHref("  ", {})).toBe("/");
    expect(browseHref("solo #1/2", { tags: ["b", "a"], sort: "title" })).toBe("/?q=solo+%231%2F2&sort=title&tags=a,b");
  });
  test("readBrowse parses q and filters, drops invalid filters", () => {
    expect(readBrowse(new URLSearchParams("q=moon&sort=title&rating=safe"))).toEqual({ q: "moon", filters: { sort: "title", ratings: ["safe"] } });
    expect(readBrowse(new URLSearchParams("sort=bogus"))).toEqual({ q: "", filters: {} });
  });
  test("browseApiPath: search when q has 2+ chars, home otherwise; filters forwarded", () => {
    expect(browseApiPath({ q: "m", filters: {}, page: 1, mature: false, source: "md" })).toBe("/api/home?page=1&mature=0&source=md");
    expect(browseApiPath({ q: " moon ", filters: { tags: ["fantasy"] }, page: 2, mature: true, source: "mock" })).toBe(
      "/api/search?q=moon&page=2&mature=1&source=mock&tags=fantasy",
    );
  });
});
