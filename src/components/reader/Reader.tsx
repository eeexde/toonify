"use client";
import { useCallback, useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/query/fetcher";
import { chapterQueryOptions, useChapter, useTitle } from "@/lib/query/hooks";
import { useSettings, useTitlePref } from "@/lib/db/hooks";
import { markCompleted, recordOpen, setReaderMode } from "@/lib/db/actions";
import { db } from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/db/types";
import { neighbors } from "@/lib/source/chapters";
import { ErrorState } from "@/components/ErrorState";
import { readHref } from "@/components/TitleCard";
import { ReaderOverlay } from "./ReaderOverlay";
import { EndCard } from "./EndCard";
import { resolveMode, type ReaderMode } from "@/lib/reader/mode";
import { PagedView } from "./PagedView";
import { StripView } from "./StripView";

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
  const pref = useTitlePref(titleId);
  // Wait for the title and the stored pref so the reader never flashes the wrong mode.
  const modeReady = pref !== undefined && (!!t || titleQ.isError);
  const mode = resolveMode(pref?.mode, t?.layout);
  const onModeChange = useCallback((m: ReaderMode) => void setReaderMode(db, titleId, m), [titleId]);

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

  const callbacks = { onPrefetch, onComplete, onScrollDown, onProgress: setProgress };
  const toggleOverlay = useCallback(() => setOverlay((v) => !v), []);
  const endCard = <EndCard titleId={titleId} current={current} next={next} />;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "[" && prev) router.push(readHref(titleId, prev.id));
      if (e.key === "]" && next) router.push(readHref(titleId, next.id));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router, titleId]);

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
        mode={mode}
        onModeChange={onModeChange}
      />
      <h1 className="sr-only">{[t?.title, current?.name].filter(Boolean).join(", ") || "Reader"}</h1>
      {!modeReady ? (
        <div role="status" aria-label="Loading chapter" className="flex h-dvh w-full items-center justify-center">
          <span aria-hidden className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
        </div>
      ) : mode === "strip" ? (
        <StripView
          titleId={titleId}
          chapterId={chapterId}
          pages={pages}
          pending={chapterQ.isPending}
          readerWidth={settings.readerWidth}
          onToggleOverlay={toggleOverlay}
          callbacks={callbacks}
          endCard={endCard}
        />
      ) : (
        <PagedView
          key={mode}
          titleId={titleId}
          chapterId={chapterId}
          pages={pages}
          pending={chapterQ.isPending}
          mode={mode}
          onToggleOverlay={toggleOverlay}
          callbacks={callbacks}
          endCard={endCard}
        />
      )}
    </div>
  );
}
