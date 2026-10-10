"use client";
import { useCallback } from "react";
import { useHome } from "@/lib/query/hooks";
import { useHistory, useSettings } from "@/lib/db/hooks";
import { DEFAULT_SETTINGS } from "@/lib/db/types";
import { readHref, TitleCard } from "@/components/TitleCard";
import { GridSkeleton, TitleGrid } from "@/components/TitleGrid";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { ErrorState } from "@/components/ErrorState";
import { Footer } from "@/components/Footer";

function ContinueRow() {
  const history = useHistory();
  if (!history?.length) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">Continue reading</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {history.slice(0, 12).map((h) => (
          <div key={h.titleId} className="w-28 shrink-0">
            <TitleCard item={{ id: h.titleId, title: h.title, cover: h.cover }} href={readHref(h.titleId, h.chapterId)} subtitle={h.chapterName} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const stored = useSettings();
  const settings = stored ?? DEFAULT_SETTINGS;
  const q = useHome(settings.mature, settings.source, stored !== undefined);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const seen = new Set<string>();
  const items = (q.data?.pages.flatMap((p) => p.items) ?? []).filter((it) => !seen.has(it.id) && !!seen.add(it.id));

  return (
    <>
      <ContinueRow />
      <h2 className="mb-3 text-lg font-semibold">Latest updates</h2>
      {q.isPending ? (
        <GridSkeleton />
      ) : q.isError && items.length === 0 ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : (
        <>
          <TitleGrid>
            {items.map((it) => <TitleCard key={it.id} item={it} />)}
          </TitleGrid>
          <InfiniteSentinel onVisible={loadMore} disabled={!hasNextPage} />
          {isFetchingNextPage && <p className="py-6 text-center text-sm text-muted">Loading…</p>}
          {q.isFetchNextPageError && <ErrorState message="Couldn't load more." onRetry={loadMore} />}
        </>
      )}
      <Footer />
    </>
  );
}
