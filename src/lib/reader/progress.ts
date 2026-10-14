export const THRESHOLDS = { prefetch: 0.7, complete: 0.95 } as const;

export function scrollRatio(scrollY: number, docHeight: number, viewport: number): number {
  const max = docHeight - viewport;
  if (max <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / max));
}

export function currentPageIndex(tops: number[]): number {
  let idx = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= 1) idx = i;
  return idx;
}

export interface Measure {
  y: number;
  pageIndex: number;
  ratio: number;
}

export interface TrackerDeps {
  pageCount: number;
  measure: () => Measure;
  persist: (s: { pageIndex: number; ratio: number }) => void;
  onPrefetch: () => void;
  /** Returns true if completion was actually recorded. */
  onComplete: () => boolean;
  onScrollDown: () => void;
  initialY?: number;
}

/**
 * Holds a snapshot of reader position that is updated only from live scroll
 * measurements. save() persists the snapshot and never touches the DOM, so an
 * SPA navigation cannot make the cleanup record the next page's position.
 */
export function createTracker(d: TrackerDeps) {
  const snapshot = { pageIndex: 0, ratio: 0 };
  let dirty = false;
  let unmounting = false;
  let prefetched = false;
  let completed = false;
  let lastY = d.initialY ?? 0;

  return {
    snapshot,
    get unmounting() {
      return unmounting;
    },
    update() {
      if (unmounting) return;
      const m = d.measure();
      snapshot.pageIndex = m.pageIndex;
      snapshot.ratio = m.ratio;
      dirty = true;
      if (m.y > lastY + 10) d.onScrollDown();
      lastY = m.y;
      if (!prefetched && m.ratio >= THRESHOLDS.prefetch) {
        prefetched = true;
        d.onPrefetch();
      }
      if (!completed && d.pageCount > 0 && m.ratio >= THRESHOLDS.complete) {
        if (d.onComplete()) completed = true;
      }
    },
    save() {
      if (!dirty) return;
      dirty = false;
      d.persist({ pageIndex: snapshot.pageIndex, ratio: snapshot.ratio });
    },
    dispose() {
      unmounting = true;
      this.save();
    },
  };
}

/** Tracker `y` step per page, comfortably above createTracker's 10px "scrolled down" threshold. */
const PAGE_STEP_Y = 1000;

/** Measurement for the paged reader. `index === pageCount` is the end card. */
export function pagedMeasure(index: number, pageCount: number): Measure {
  if (pageCount <= 0) return { y: 0, pageIndex: 0, ratio: 0 };
  return { y: index * PAGE_STEP_Y, pageIndex: Math.min(index, pageCount - 1), ratio: Math.min(1, (index + 1) / pageCount) };
}

/** A saved page index clipped to the chapter (it may come from an older, longer upload). */
export function clampRestore(saved: number | undefined, pageCount: number): number {
  if (!saved || pageCount <= 0) return 0;
  return Math.min(Math.max(0, saved), pageCount - 1);
}
