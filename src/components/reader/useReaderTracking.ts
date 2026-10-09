"use client";
import { useEffect, useRef } from "react";
import { db } from "@/lib/db/schema";
import { saveProgress } from "@/lib/db/actions";
import { currentPageIndex, scrollRatio, THRESHOLDS } from "@/lib/reader/progress";

interface Args {
  titleId: string;
  chapterId: string;
  pageCount: number;
  onPrefetch: () => void;
  onComplete: () => void;
  onScrollDown: () => void;
}

function pageTops(): number[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-page-index]")).map((el) => el.getBoundingClientRect().top);
}

export function useReaderTracking({ titleId, chapterId, pageCount, onPrefetch, onComplete, onScrollDown }: Args) {
  const cb = useRef({ onPrefetch, onComplete, onScrollDown });
  cb.current = { onPrefetch, onComplete, onScrollDown };

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
    let prefetched = false;
    let completed = false;
    let dirty = false;
    let lastY = window.scrollY;

    const ratio = () => scrollRatio(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);
    const save = () => {
      if (!dirty) return;
      dirty = false;
      void saveProgress(db, { titleId, chapterId, pageIndex: currentPageIndex(pageTops()), scrollRatio: ratio() });
    };
    const onScroll = () => {
      dirty = true;
      const y = window.scrollY;
      if (y > lastY + 10) cb.current.onScrollDown();
      lastY = y;
      const r = ratio();
      if (!prefetched && r >= THRESHOLDS.prefetch) {
        prefetched = true;
        cb.current.onPrefetch();
      }
      if (!completed && r >= THRESHOLDS.complete && y > 0) {
        completed = true;
        cb.current.onComplete();
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    const timer = setInterval(save, 2000);
    return () => {
      save();
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [titleId, chapterId, pageCount]);
}
