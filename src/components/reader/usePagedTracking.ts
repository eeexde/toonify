"use client";
import { useEffect, useRef } from "react";
import { db } from "@/lib/db/schema";
import { saveProgress } from "@/lib/db/actions";
import { createTracker, pagedMeasure } from "@/lib/reader/progress";

interface Args {
  titleId: string;
  chapterId: string;
  pageCount: number;
  /** Current page; equals pageCount while the end card is shown. */
  index: number;
  onPrefetch: () => void;
  onComplete: () => boolean;
  onScrollDown: () => void;
  onProgress?: (ratio: number) => void;
}

/** Paged-reader twin of useReaderTracking: same tracker, fed page turns instead of scroll positions. */
export function usePagedTracking({ titleId, chapterId, pageCount, index, onPrefetch, onComplete, onScrollDown, onProgress }: Args) {
  const cb = useRef({ onPrefetch, onComplete, onScrollDown, onProgress });
  cb.current = { onPrefetch, onComplete, onScrollDown, onProgress };
  const indexRef = useRef(index);
  indexRef.current = index;
  const trackerRef = useRef<ReturnType<typeof createTracker> | null>(null);

  useEffect(() => {
    if (pageCount === 0) return;
    const tracker = createTracker({
      pageCount,
      initialY: pagedMeasure(indexRef.current, pageCount).y,
      measure: () => pagedMeasure(indexRef.current, pageCount),
      persist: (s) => void saveProgress(db, { titleId, chapterId, pageIndex: s.pageIndex, scrollRatio: s.ratio }),
      onPrefetch: () => cb.current.onPrefetch(),
      onComplete: () => cb.current.onComplete(),
      onScrollDown: () => cb.current.onScrollDown(),
    });
    trackerRef.current = tracker;
    cb.current.onProgress?.(pagedMeasure(indexRef.current, pageCount).ratio);
    const save = () => tracker.save();
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    const timer = setInterval(save, 2000);
    return () => {
      trackerRef.current = null;
      tracker.dispose();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [titleId, chapterId, pageCount]);

  useEffect(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    tracker.update();
    cb.current.onProgress?.(tracker.snapshot.ratio);
  }, [index]);
}
