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

import { clampRestore, createTracker, pagedMeasure, type Measure } from "@/lib/reader/progress";
import { vi } from "vitest";

describe("createTracker", () => {
  const mk = (m: { cur: Measure }, over: Partial<Parameters<typeof createTracker>[0]> = {}) => {
    const persist = vi.fn();
    const onComplete = vi.fn(() => true);
    const t = createTracker({ pageCount: 3, measure: () => m.cur, persist, onPrefetch: vi.fn(), onComplete, onScrollDown: vi.fn(), ...over });
    return { t, persist, onComplete };
  };

  test("dispose saves the last live snapshot, not a later measurement", () => {
    const m = { cur: { y: 500, pageIndex: 2, ratio: 0.4 } };
    const { t, persist } = mk(m);
    t.update();
    m.cur = { y: 0, pageIndex: 0, ratio: 0 }; // DOM now belongs to next page
    t.dispose();
    expect(persist).toHaveBeenCalledWith({ pageIndex: 2, ratio: 0.4 });
  });

  test("updates after dispose are ignored", () => {
    const m = { cur: { y: 500, pageIndex: 2, ratio: 0.4 } };
    const { t, persist } = mk(m);
    t.dispose();
    t.update();
    t.save();
    expect(persist).not.toHaveBeenCalled();
    expect(t.snapshot.pageIndex).toBe(0);
  });

  test("completion latches only when onComplete returns true", () => {
    const m = { cur: { y: 900, pageIndex: 2, ratio: 1 } };
    const onComplete = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const { t } = mk(m, { onComplete });
    t.update();
    t.update();
    t.update();
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  test("short content (ratio 1 at y 0) completes once pages loaded, not before", () => {
    const m = { cur: { y: 0, pageIndex: 0, ratio: 1 } };
    const a = mk(m);
    a.t.update();
    expect(a.onComplete).toHaveBeenCalledTimes(1);
    const b = mk(m, { pageCount: 0 });
    b.t.update();
    expect(b.onComplete).not.toHaveBeenCalled();
  });
});

describe("paged progress", () => {
  test("pagedMeasure: ratio counts the current page as read; end card = 1", () => {
    expect(pagedMeasure(0, 5)).toMatchObject({ pageIndex: 0, ratio: 0.2 });
    expect(pagedMeasure(4, 5)).toMatchObject({ pageIndex: 4, ratio: 1 });
    expect(pagedMeasure(5, 5)).toMatchObject({ pageIndex: 4, ratio: 1 });
    expect(pagedMeasure(0, 0)).toMatchObject({ pageIndex: 0, ratio: 0 });
  });
  test("drives the tracker: forward hides chrome, prefetch at 0.7, complete on the last page", () => {
    let i = 0;
    const onPrefetch = vi.fn();
    const onComplete = vi.fn(() => true);
    const onScrollDown = vi.fn();
    const t = createTracker({ pageCount: 5, measure: () => pagedMeasure(i, 5), persist: vi.fn(), onPrefetch, onComplete, onScrollDown });
    i = 1; t.update();
    expect(onScrollDown).toHaveBeenCalledTimes(1);
    i = 2; t.update();
    expect(onPrefetch).not.toHaveBeenCalled();
    i = 3; t.update();
    expect(onPrefetch).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    i = 4; t.update();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  test("clampRestore keeps a saved page inside the chapter", () => {
    expect(clampRestore(undefined, 5)).toBe(0);
    expect(clampRestore(2, 5)).toBe(2);
    expect(clampRestore(12, 5)).toBe(4);
    expect(clampRestore(-1, 5)).toBe(0);
    expect(clampRestore(3, 0)).toBe(0);
  });
});
