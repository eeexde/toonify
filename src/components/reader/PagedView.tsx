"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { db } from "@/lib/db/schema";
import { keyAction, swipeAction, tapAction, type PagedMode, type PageStep } from "@/lib/reader/mode";
import { clampRestore } from "@/lib/reader/progress";
import { ReaderPage } from "./ReaderPage";
import type { ReaderCallbacks } from "./StripView";
import { usePagedTracking } from "./usePagedTracking";

const PRELOAD = [1, 2, -1, -2];

/** One page at a time, fitted to the screen; the end card is the "page" after the last image. */
export function PagedView({
  titleId,
  chapterId,
  pages,
  pending,
  mode,
  onToggleOverlay,
  callbacks,
  endCard,
}: {
  titleId: string;
  chapterId: string;
  pages: string[];
  pending: boolean;
  mode: PagedMode;
  onToggleOverlay: () => void;
  callbacks: ReaderCallbacks;
  endCard: ReactNode;
}) {
  const count = pages.length;
  const [index, setIndex] = useState(0);
  // Tracking starts only after the saved page is restored, so a save can never overwrite it with page 0.
  const [restored, setRestored] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    if (count === 0) return;
    let cancelled = false;
    setIndex(0);
    setRestored(false);
    db.progress.get([titleId, chapterId]).then((p) => {
      if (cancelled) return;
      if (p && !p.completed) setIndex(clampRestore(p.pageIndex, count));
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [titleId, chapterId, count]);

  usePagedTracking({ titleId, chapterId, pageCount: restored ? count : 0, index, ...callbacks });

  const go = useCallback((step: PageStep) => setIndex((i) => (step === "next" ? Math.min(i + 1, count) : Math.max(i - 1, 0))), [count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
      const step = keyAction(e.key, mode);
      if (!step) return;
      e.preventDefault();
      go(step);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, go]);

  useEffect(() => {
    for (const d of PRELOAD) {
      const src = pages[index + d];
      if (src) new Image().src = src;
    }
  }, [index, pages]);

  if (pending) {
    return (
      <div role="status" aria-label="Loading chapter" className="flex h-dvh w-full items-center justify-center">
        <span aria-hidden className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
      </div>
    );
  }

  if (index >= count) {
    return (
      <div className="min-h-dvh pt-[env(safe-area-inset-top)]">
        <div className="flex justify-center pt-16">
          <button type="button" onClick={() => go("prev")} className="press min-h-11 rounded-full border border-white/20 px-5 text-sm font-semibold text-white">
            Back to page {count}
          </button>
        </div>
        {endCard}
      </div>
    );
  }

  return (
    <div
      className="h-dvh w-full touch-pinch-zoom select-none overflow-hidden"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        swiped.current = false;
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const step = swipeAction(e.clientX - s.x, e.clientY - s.y, mode);
        if (step) {
          swiped.current = true;
          go(step);
        }
      }}
      onClick={(e) => {
        // A swipe ends with a click on the same element; it already turned the page.
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        const action = tapAction(e.clientX, window.innerWidth, mode);
        if (action === "toggle") onToggleOverlay();
        else go(action);
      }}
    >
      <ReaderPage key={pages[index]} src={pages[index]} index={index} eager fit />
    </div>
  );
}
