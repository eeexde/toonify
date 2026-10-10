"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/query/fetcher";
import { chapterQueryOptions, useChapter, useTitle } from "@/lib/query/hooks";
import { useSettings } from "@/lib/db/hooks";
import { markCompleted, recordOpen } from "@/lib/db/actions";
import { db } from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/db/types";
import { neighbors } from "@/lib/source/chapters";
import { ErrorState } from "@/components/ErrorState";
import { Icon } from "@/components/icons";
import { readHref, titleHref } from "@/components/TitleCard";
import { ReaderOverlay } from "./ReaderOverlay";
import { ReaderPage } from "./ReaderPage";
import { useReaderTracking } from "./useReaderTracking";

export function Reader({ titleId, chapterId }: { titleId: string; chapterId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const settings = useSettings() ?? DEFAULT_SETTINGS;
  const titleQ = useTitle(titleId);
  const chapterQ = useChapter(titleId, chapterId);
  const [overlay, setOverlay] = useState(true);
  const [progress, setProgress] = useState(0);

  const t = titleQ.data;
  const chapters = t?.chapters ?? [];
  const current = chapters.find((c) => c.id === chapterId);
  const { prev, next } = neighbors(chapters, chapterId);
  const pages = chapterQ.data?.pages ?? [];

  useEffect(() => {
    if (t && current) {
      void recordOpen(db, { titleId, title: t.title, cover: t.cover, chapterId, chapterName: current.name });
    }
  }, [t, current, titleId, chapterId]);

  const onPrefetch = useCallback(async () => {
    if (!next) return;
    const data = await qc.fetchQuery(chapterQueryOptions(titleId, next.id)).catch(() => null);
    data?.pages.slice(0, 3).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [next, qc, titleId]);

  const onComplete = useCallback((): boolean => {
    if (!t || !current) return false;
    void markCompleted(db, { titleId, title: t.title, cover: t.cover, chapterId, chapterName: current.name });
    return true;
  }, [t, current, titleId, chapterId]);

  const onScrollDown = useCallback(() => setOverlay(false), []);

  useReaderTracking({ titleId, chapterId, pageCount: pages.length, onPrefetch, onComplete, onScrollDown, onProgress: setProgress });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "[" && prev) router.push(readHref(titleId, prev.id));
      if (e.key === "]" && next) router.push(readHref(titleId, next.id));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router, titleId]);

  const onTap = (e: React.MouseEvent) => {
    const w = window.innerWidth;
    if (e.clientX > w / 3 && e.clientX < (2 * w) / 3) setOverlay((v) => !v);
  };

  if (chapterQ.isError && chapterQ.error instanceof ApiError && (chapterQ.error.status === 404 || chapterQ.error.status === 400)) notFound();
  if (chapterQ.isError) {
    return (
      <div className="px-4 pt-[env(safe-area-inset-top)]">
        <ErrorState message={chapterQ.error.message} onRetry={() => chapterQ.refetch()} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-black">
      <ReaderOverlay
        visible={overlay}
        progress={progress}
        titleId={titleId}
        title={t?.title ?? ""}
        chapterId={chapterId}
        chapters={chapters}
        prev={prev}
        next={next}
      />
      <h1 className="sr-only">{[t?.title, current?.name].filter(Boolean).join(", ") || "Reader"}</h1>
      <div onClick={onTap} className="mx-auto" style={{ maxWidth: `min(100%, ${settings.readerWidth}px)` }}>
        {chapterQ.isPending
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} role={i === 0 ? "status" : undefined} aria-label={i === 0 ? "Loading chapter" : undefined} className="flex aspect-[2/3] w-full items-center justify-center bg-neutral-950">
                {i === 0 && <span aria-hidden className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />}
              </div>
            ))
          : pages.map((src, i) => <ReaderPage key={src} src={src} index={i} eager={i < 3} />)}
      </div>
      {!chapterQ.isPending && (
        <section aria-label="End of chapter" className="mx-auto max-w-md px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-14 text-center text-white">
          <p className="display text-[2.5rem] text-white">End of {current?.name ?? "chapter"}</p>
          {current?.group && (
            <p className="mt-2 text-sm text-neutral-400">
              Scanlated by <span className="font-semibold text-neutral-200">{current.group}</span>
              {titleId.startsWith("md:") ? " · via MangaDex" : ""}
            </p>
          )}
          {next ? (
            <Link
              href={readHref(titleId, next.id)}
              className="press mt-7 flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-base font-bold text-[var(--accent-fg)] shadow-[0_10px_40px_-10px_var(--accent)]"
            >
              Next: {next.name}
              <Icon name="forward" className="h-5 w-5" strokeWidth={2.4} />
            </Link>
          ) : (
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-5 py-6">
              <p className="text-lg font-bold text-white">You&apos;re caught up.</p>
              <p className="mt-1 text-sm text-neutral-400">New chapters will show up on the title page and in your library.</p>
            </div>
          )}
          <Link
            href={titleHref(titleId)}
            className={`press mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 text-sm font-semibold hover:text-white ${next ? "text-neutral-300" : "mt-5 border border-white/20 text-white"}`}
          >
            <Icon name="back" className="h-4 w-4" />
            Back to title
          </Link>
        </section>
      )}
    </div>
  );
}
