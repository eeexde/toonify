"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSearch } from "@/lib/query/hooks";
import { useSettings } from "@/lib/db/hooks";
import { DEFAULT_SETTINGS } from "@/lib/db/types";
import { TitleCard } from "@/components/TitleCard";
import { GridSkeleton, TitleGrid } from "@/components/TitleGrid";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/icons";

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [input, setInput] = useState(params.get("q") ?? "");
  const [term, setTerm] = useState(input);
  const stored = useSettings();
  const settings = stored ?? DEFAULT_SETTINGS;

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(input);
      const trimmed = input.trim();
      router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search", { scroll: false });
    }, 400);
    return () => clearTimeout(t);
  }, [input, router]);

  const q = useSearch(term, settings.mature, settings.source, stored !== undefined);
  const short = term.trim().length < 2;

  return (
    <>
      <h1 className="display mb-4 text-[2.25rem] md:text-[2.75rem]">Search</h1>
      <div className="sticky top-0 z-20 -mx-4 mb-6 bg-bg/95 px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Title, e.g. Solo Leveling"
            aria-label="Search manhwa"
            maxLength={100}
            enterKeyHint="search"
            autoComplete="off"
            className="h-[52px] w-full appearance-none rounded-2xl border border-line-strong/60 bg-card pl-12 pr-12 text-base text-fg shadow-card outline-none transition-colors placeholder:text-muted focus:border-accent focus-visible:outline-none focus:ring-[3px] focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
          />
          {input && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setInput("")}
              className="press absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-fg"
            >
              <Icon name="x" className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>
      {short ? (
        <EmptyState icon="search" title="Find a series" body="Type at least 2 characters." />
      ) : q.isPending ? (
        <GridSkeleton count={6} />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState role="status" icon="search" title={`No results for “${term.trim()}”.`} body="Check the spelling, or try a shorter part of the title." />
      ) : (
        <>
          <p role="status" className="mb-4 text-sm text-muted">
            {q.data.items.length}{q.data.hasMore ? "+" : ""} {q.data.items.length === 1 ? "match" : "matches"} for <span className="font-semibold text-fg">{term.trim()}</span>
          </p>
          <TitleGrid>
            {q.data.items.map((it) => <TitleCard key={it.id} item={it} />)}
          </TitleGrid>
        </>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
