"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { chapterQueryOptions, useChapter, useTitle } from "@/lib/query/hooks";
import { useSettings } from "@/lib/db/hooks";
import { markCompleted, recordOpen } from "@/lib/db/actions";
import { db } from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/db/types";
import { neighbors } from "@/lib/source/chapters";
import { ErrorState } from "@/components/ErrorState";
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

  const onComplete = useCallback(() => {
    if (t && current) void markCompleted(db, { titleId, title: t.title, cover: t.cover, chapterId, chapterName: current.name });
  }, [t, current, titleId, chapterId]);

  const onScrollDown = useCallback(() => setOverlay(false), []);

  useReaderTracking({ titleId, chapterId, pageCount: pages.length, onPrefetch, onComplete, onScrollDown });

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

  if (chapterQ.isError) {
    return <ErrorState message={chapterQ.error.message} onRetry={() => chapterQ.refetch()} />;
  }

  return (
    <div className="-mx-4 -mt-4 min-h-dvh bg-black">
      <ReaderOverlay
        visible={overlay}
        titleId={titleId}
        title={t?.title ?? ""}
        chapterId={chapterId}
        chapters={chapters}
        prev={prev}
        next={next}
      />
      <div onClick={onTap} className="mx-auto" style={{ maxWidth: `min(100%, ${settings.readerWidth}px)` }}>
        {chapterQ.isPending
          ? Array.from({ length: 3 }, (_, i) => <div key={i} className="aspect-[2/3] w-full animate-pulse bg-card" />)
          : pages.map((src, i) => <ReaderPage key={src} src={src} index={i} eager={i < 3} />)}
      </div>
      {!chapterQ.isPending && (
        <div className="mx-auto max-w-md px-4 py-10 text-center text-white">
          {current?.group && <p className="text-sm text-neutral-400">Scanlated by {current.group}{titleId.startsWith("md:") ? " · via MangaDex" : ""}</p>}
          {next ? (
            <Link href={readHref(titleId, next.id)} className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-accent font-semibold text-accent-fg">
              Next: {next.name}
            </Link>
          ) : (
            <p className="mt-4 text-sm text-neutral-400">You&apos;re caught up.</p>
          )}
          <Link href={titleHref(titleId)} className="mt-3 inline-block text-sm text-neutral-400 underline">Back to title</Link>
        </div>
      )}
    </div>
  );
}
