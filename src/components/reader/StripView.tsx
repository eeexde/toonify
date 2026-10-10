"use client";
import type { ReactNode } from "react";
import { ReaderPage } from "./ReaderPage";
import { useReaderTracking } from "./useReaderTracking";

export interface ReaderCallbacks {
  onPrefetch: () => void;
  onComplete: () => boolean;
  onScrollDown: () => void;
  onProgress: (ratio: number) => void;
}

/** The vertical long-strip reader. */
export function StripView({
  titleId,
  chapterId,
  pages,
  pending,
  readerWidth,
  onToggleOverlay,
  callbacks,
  endCard,
}: {
  titleId: string;
  chapterId: string;
  pages: string[];
  pending: boolean;
  readerWidth: number;
  onToggleOverlay: () => void;
  callbacks: ReaderCallbacks;
  endCard: ReactNode;
}) {
  useReaderTracking({ titleId, chapterId, pageCount: pages.length, ...callbacks });

  const onTap = (e: React.MouseEvent) => {
    const w = window.innerWidth;
    if (e.clientX > w / 3 && e.clientX < (2 * w) / 3) onToggleOverlay();
  };

  return (
    <>
      <div onClick={onTap} className="mx-auto" style={{ maxWidth: `min(100%, ${readerWidth}px)` }}>
        {pending
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} role={i === 0 ? "status" : undefined} aria-label={i === 0 ? "Loading chapter" : undefined} className="flex aspect-[2/3] w-full items-center justify-center bg-neutral-950">
                {i === 0 && <span aria-hidden className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />}
              </div>
            ))
          : pages.map((src, i) => <ReaderPage key={src} src={src} index={i} eager={i < 3} />)}
      </div>
      {!pending && endCard}
    </>
  );
}
