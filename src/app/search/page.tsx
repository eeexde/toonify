"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSearch } from "@/lib/query/hooks";
import { useSettings } from "@/lib/db/hooks";
import { DEFAULT_SETTINGS } from "@/lib/db/types";
import { TitleCard } from "@/components/TitleCard";
import { GridSkeleton, TitleGrid } from "@/components/TitleGrid";
import { ErrorState } from "@/components/ErrorState";

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
      <input
        type="search"
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search manhwa…"
        aria-label="Search manhwa"
        maxLength={100}
        className="mb-5 w-full rounded-full border border-line bg-card px-5 py-3 text-base outline-none focus:border-accent"
      />
      {short ? (
        <p className="py-10 text-center text-sm text-muted">Type at least 2 characters.</p>
      ) : q.isPending ? (
        <GridSkeleton count={6} />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No results for “{term.trim()}”.</p>
      ) : (
        <TitleGrid>
          {q.data.items.map((it) => <TitleCard key={it.id} item={it} />)}
        </TitleGrid>
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
