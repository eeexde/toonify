"use client";
import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useBrowse, useTags } from "@/lib/query/hooks";
import { browseHref, isSearching, readBrowse } from "@/lib/query/browse";
import { hasFilters, type Filters } from "@/lib/source/filters";
import { useHistory, useProgressMap, useSettings } from "@/lib/db/hooks";
import { DEFAULT_SETTINGS, type HistoryItem } from "@/lib/db/types";
import { readHref, TitleCard } from "@/components/TitleCard";
import { GridSkeleton, TitleGrid } from "@/components/TitleGrid";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { ErrorState } from "@/components/ErrorState";
import { Footer } from "@/components/Footer";
import { EmptyState, buttonSecondary } from "@/components/EmptyState";
import { FilterBar } from "@/components/Filters";

function ContinueCard({ h, lead }: { h: HistoryItem; lead: boolean }) {
  const progress = useProgressMap(h.titleId);
  const p = progress?.get(h.chapterId);
  const pct = p ? (p.completed ? 100 : Math.round(p.scrollRatio * 100)) : 0;
  return (
    <Link
      href={readHref(h.titleId, h.chapterId)}
      className={`press group relative flex w-[min(80vw,320px)] shrink-0 snap-start gap-3 overflow-hidden rounded-2xl border p-2.5 pr-4 ${
        lead ? "border-accent/40 bg-card shadow-glow" : "border-line bg-card"
      }`}
    >
      <img src={h.cover} alt="" className="h-[104px] w-[70px] shrink-0 rounded-lg bg-surface-2 object-cover" />
      <span className="flex min-w-0 flex-1 flex-col py-1">
        <span className="line-clamp-2 text-[15px] font-bold leading-snug">{h.title}</span>
        <span className="mt-0.5 truncate text-[13px] text-muted">{h.chapterName}</span>
        <span className="mt-auto flex items-center gap-2 pt-2">
          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(pct, 4)}%` }} />
          </span>
          <span className="w-9 text-right text-xs font-semibold tabular-nums text-accent-text">{pct}%</span>
        </span>
      </span>
    </Link>
  );
}

function ContinueRow() {
  const history = useHistory();
  if (!history?.length) return null;
  return (
    <section aria-labelledby="continue-h" className="mb-6">
      <h2 id="continue-h" className="display mb-2 text-[1.75rem]">Continue reading</h2>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-8 pt-1 md:-mx-6 md:scroll-px-6 md:px-6">
        {history.slice(0, 12).map((h, i) => (
          <ContinueCard key={h.titleId} h={h} lead={i === 0} />
        ))}
      </div>
    </section>
  );
}

function HomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- params identity changes every render; key is its content
  const state = useMemo(() => readBrowse(params), [key]);
  const stored = useSettings();
  const settings = stored ?? DEFAULT_SETTINGS;
  const ready = stored !== undefined;
  const searching = isSearching(state.q);
  const filtered = hasFilters(state.filters);
  const browsing = searching || filtered;

  const q = useBrowse(state, settings.mature, settings.source, ready);
  const tagsQ = useTags(settings.source, ready);
  const tags = tagsQ.data ?? [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const setFilters = (f: Filters) => router.replace(browseHref(state.q, f), { scroll: false });

  const seen = new Set<string>();
  const items = (q.data?.pages.flatMap((p) => p.items) ?? []).filter((it) => !seen.has(it.id) && !!seen.add(it.id));
  const term = state.q.trim();
  const heading = searching ? "Results" : filtered ? "Browse" : "Latest updates";

  return (
    <>
      <h1 className="sr-only">Home</h1>
      {!browsing && <ContinueRow />}
      <section aria-labelledby="latest-h">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="latest-h" className="display text-[1.75rem]">{heading}</h2>
          {settings.mature && <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-muted">18+ on</span>}
        </div>
        {tags.length > 0 && (
          <FilterBar filters={state.filters} tags={tags} mature={settings.mature} searching={searching} onChange={setFilters} />
        )}
        {!ready || q.isPending ? (
          <GridSkeleton />
        ) : q.isError && items.length === 0 ? (
          <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          searching ? (
            <EmptyState role="status" icon="search" title={`No results for “${term}”.`} body={filtered ? "Try removing a filter, or check the spelling." : "Check the spelling, or try a shorter part of the title."} />
          ) : (
            <EmptyState
              role="status"
              icon="filter"
              title="No titles match these filters."
              action={<button type="button" onClick={() => setFilters({})} className={buttonSecondary}>Clear filters</button>}
            />
          )
        ) : (
          <>
            {searching && (
              <p role="status" className="mb-4 text-sm text-muted">
                {items.length}{hasNextPage ? "+" : ""} {items.length === 1 ? "match" : "matches"} for <span className="font-semibold text-fg">{term}</span>
              </p>
            )}
            <TitleGrid>
              {items.map((it) => <TitleCard key={it.id} item={it} />)}
            </TitleGrid>
            <InfiniteSentinel onVisible={loadMore} disabled={!hasNextPage} />
            {isFetchingNextPage && (
              <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
                <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
                Loading more…
              </p>
            )}
            {q.isFetchNextPageError && <ErrorState message="Couldn't load more." onRetry={loadMore} />}
          </>
        )}
      </section>
      <Footer />
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <HomeInner />
    </Suspense>
  );
}
