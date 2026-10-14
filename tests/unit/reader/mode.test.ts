import { describe, expect, test } from "vitest";
import { keyAction, resolveMode, swipeAction, tapAction } from "@/lib/reader/mode";

describe("resolveMode", () => {
  test("pref wins; otherwise paged layout -> rtl, anything else -> strip", () => {
    expect(resolveMode("paged-ltr", "strip")).toBe("paged-ltr");
    expect(resolveMode(undefined, "paged")).toBe("paged-rtl");
    expect(resolveMode(undefined, "strip")).toBe("strip");
    expect(resolveMode(undefined, undefined)).toBe("strip"); // title cached before manga support
  });
});

describe("tapAction", () => {
  test("centre third toggles chrome", () => {
    expect(tapAction(500, 900, "paged-rtl")).toBe("toggle");
  });
  test("rtl: left is next, right is prev", () => {
    expect(tapAction(100, 900, "paged-rtl")).toBe("next");
    expect(tapAction(800, 900, "paged-rtl")).toBe("prev");
  });
  test("ltr: right is next, left is prev", () => {
    expect(tapAction(800, 900, "paged-ltr")).toBe("next");
    expect(tapAction(100, 900, "paged-ltr")).toBe("prev");
  });
});

describe("keyAction", () => {
  test("arrows follow reading direction; other keys ignored", () => {
    expect(keyAction("ArrowLeft", "paged-rtl")).toBe("next");
    expect(keyAction("ArrowRight", "paged-rtl")).toBe("prev");
    expect(keyAction("ArrowRight", "paged-ltr")).toBe("next");
    expect(keyAction("ArrowLeft", "paged-ltr")).toBe("prev");
    expect(keyAction("]", "paged-rtl")).toBeNull();
  });
});

describe("swipeAction", () => {
  test("ignores short or mostly vertical swipes", () => {
    expect(swipeAction(-40, 0, "paged-ltr")).toBeNull();
    expect(swipeAction(-80, 120, "paged-ltr")).toBeNull();
  });
  test("ltr: swipe left -> next; rtl: swipe right -> next", () => {
    expect(swipeAction(-80, 10, "paged-ltr")).toBe("next");
    expect(swipeAction(80, 10, "paged-ltr")).toBe("prev");
    expect(swipeAction(80, 10, "paged-rtl")).toBe("next");
    expect(swipeAction(-80, 10, "paged-rtl")).toBe("prev");
  });
});
