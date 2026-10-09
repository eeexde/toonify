import { describe, expect, test } from "vitest";
import { currentPageIndex, scrollRatio } from "@/lib/reader/progress";

describe("reader progress", () => {
  test("scrollRatio clamps and handles short pages", () => {
    expect(scrollRatio(0, 1000, 800)).toBe(0);
    expect(scrollRatio(100, 1000, 800)).toBe(0.5);
    expect(scrollRatio(500, 1000, 800)).toBe(1);
    expect(scrollRatio(0, 500, 800)).toBe(1);
  });
  test("currentPageIndex = last page whose top is at/above viewport top", () => {
    expect(currentPageIndex([])).toBe(0);
    expect(currentPageIndex([10, 900, 1800])).toBe(0);
    expect(currentPageIndex([-1200, -300, 600])).toBe(1);
    expect(currentPageIndex([-2000, -1000, 0])).toBe(2);
  });
});
