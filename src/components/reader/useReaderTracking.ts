"use client";
import { useEffect, useRef } from "react";
import { db } from "@/lib/db/schema";
import { saveProgress } from "@/lib/db/actions";
import { createTracker, currentPageIndex, scrollRatio } from "@/lib/reader/progress";

interface Args {
  titleId: string;
  chapterId: string;
  pageCount: number;
  onPrefetch: () => void;
  onComplete: () => boolean;
  onScrollDown: () => void;
  onProgress?: (ratio: number) => void;
}

function pageTops(): number[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-page-index]")).map((el) => el.getBoundingClientRect().top);
}

export function useReaderTracking({ titleId, chapterId, pageCount, onPrefetch, onComplete, onScrollDown, onProgress }: Args) {
  const cb = useRef({ onPrefetch, onComplete, onScrollDown, onProgress });
  cb.current = { onPrefetch, onComplete, onScrollDown, onProgress };

  // Restore saved position once pages are rendered.
  useEffect(() => {
    if (pageCount === 0) return;
    let cancelled = false;
    db.progress.get([titleId, chapterId]).then((p) => {
      if (cancelled || !p || p.completed || p.pageIndex <= 0) {
        if (!p) window.scrollTo(0, 0);
        return;
      }
      document.querySelector(`[data-page-index="${p.pageIndex}"]`)?.scrollIntoView({ block: "start" });
    });
    return () => {
      cancelled = true;
    };
  }, [titleId, chapterId, pageCount]);

  // Track scroll, thresholds and periodic saves.
  useEffect(() => {
    if (pageCount === 0) return;
    const tracker = createTracker({
      pageCount,
      initialY: window.scrollY,
      measure: () => {
        const y = window.scrollY;
        return {
          y,
          pageIndex: currentPageIndex(pageTops()),
          ratio: scrollRatio(y, document.documentElement.scrollHeight, window.innerHeight),
        };
      },
      persist: (s) => void saveProgress(db, { titleId, chapterId, pageIndex: s.pageIndex, scrollRatio: s.ratio }),
      onPrefetch: () => cb.current.onPrefetch(),
      onComplete: () => cb.current.onComplete(),
      onScrollDown: () => cb.current.onScrollDown(),
    });
    let raf = 0;
    const onScroll = () => {
      if (tracker.unmounting || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        tracker.update();
        cb.current.onProgress?.(tracker.snapshot.ratio);
      });
    };
    const save = () => tracker.save();
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    const timer = setInterval(save, 2000);
    return () => {
      tracker.dispose();
      if (raf) cancelAnimationFrame(raf);
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [titleId, chapterId, pageCount]);
}
