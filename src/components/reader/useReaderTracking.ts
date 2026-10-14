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
  /** The page at the top of the screen, reported as the reader scrolls. */
  onPage?: (index: number) => void;
}

const PIN_MS = 8_000;

function pageTops(): number[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-page-index]")).map((el) => el.getBoundingClientRect().top);
}

export function useReaderTracking({ titleId, chapterId, pageCount, onPrefetch, onComplete, onScrollDown, onProgress, onPage }: Args) {
  const cb = useRef({ onPrefetch, onComplete, onScrollDown, onProgress, onPage });
  cb.current = { onPrefetch, onComplete, onScrollDown, onProgress, onPage };

  // Restore saved position once pages are rendered. Pages above the target start as fixed-ratio
  // placeholders and change height as their images load; browsers without scroll anchoring
  // (Safari) would drift, so keep the target pinned until the reader interacts or PIN_MS passes.
  useEffect(() => {
    if (pageCount === 0) return;
    let cancelled = false;
    let unpin = () => {};
    db.progress.get([titleId, chapterId]).then((p) => {
      if (cancelled || !p || p.completed || p.pageIndex <= 0) {
        if (!p) window.scrollTo(0, 0);
        return;
      }
      const target = document.querySelector<HTMLElement>(`[data-page-index="${p.pageIndex}"]`);
      if (!target) return;
      target.scrollIntoView({ block: "start" });
      const strip = target.parentElement;
      if (!strip || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => target.scrollIntoView({ block: "start" }));
      ro.observe(strip);
      const userEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
      const timer = setTimeout(() => unpin(), PIN_MS);
      unpin = () => {
        ro.disconnect();
        clearTimeout(timer);
        userEvents.forEach((e) => window.removeEventListener(e, unpin));
      };
      userEvents.forEach((e) => window.addEventListener(e, unpin, { passive: true, once: true }));
    });
    return () => {
      cancelled = true;
      unpin();
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
        cb.current.onPage?.(tracker.snapshot.pageIndex);
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
