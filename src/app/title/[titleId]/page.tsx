"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useTitle } from "@/lib/query/hooks";
import { ApiError } from "@/lib/query/fetcher";
import { useHistoryItem, useLibraryItem, useProgressMap } from "@/lib/db/hooks";
import { toggleLibrary, touchLatestChapter } from "@/lib/db/actions";
import { db } from "@/lib/db/schema";
import { readableChapters } from "@/lib/source/chapters";
import { readHref } from "@/components/TitleCard";
import { ErrorState } from "@/components/ErrorState";
import { Footer } from "@/components/Footer";

export default function TitlePage() {
  const params = useParams<{ titleId: string }>();
  const titleId = decodeURIComponent(params.titleId);
  const q = useTitle(titleId);
  const libItem = useLibraryItem(titleId);
  const hist = useHistoryItem(titleId);
  const progress = useProgressMap(titleId);
  const [desc, setDesc] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const t = q.data;
  const readable = useMemo(() => (t ? readableChapters(t.chapters) : []), [t]);
  const latestId = readable.at(-1)?.id;

  useEffect(() => {
    if (libItem && latestId) void touchLatestChapter(db, titleId, latestId);
  }, [libItem, latestId, titleId]);

  if (q.isError && q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 400)) notFound();
  if (q.isPending) return <div className="h-64 animate-pulse rounded-xl bg-card" />;
  if (q.isError || !t) return <ErrorState message={q.error?.message ?? "Failed to load."} onRetry={() => q.refetch()} />;

  const chapters = desc ? [...t.chapters].reverse() : t.chapters;
  const resume = hist && readable.some((c) => c.id === hist.chapterId) ? hist : null;
  const first = readable[0];

  return (
    <article>
      <div className="flex gap-4">
        <img src={t.cover} alt="" className="w-32 shrink-0 self-start rounded-lg sm:w-44" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight sm:text-2xl">{t.title}</h1>
          {(t.authors.length > 0 || t.artists.length > 0) && (
            <p className="mt-1 text-sm text-muted">{[...new Set([...t.authors, ...t.artists])].join(", ")}</p>
          )}
          {t.status && <p className="mt-1 text-xs uppercase tracking-wide text-muted">{t.status}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {t.genres.slice(0, 8).map((g) => (
              <span key={g} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{g}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {resume ? (
          <Link href={readHref(titleId, resume.chapterId)} className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-accent font-semibold text-accent-fg">
            Continue {resume.chapterName}
          </Link>
        ) : first ? (
          <Link href={readHref(titleId, first.id)} className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-accent font-semibold text-accent-fg">
            Start reading
          </Link>
        ) : (
          <p className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-line text-sm text-muted">
            No chapters readable here
          </p>
        )}
        <button
          onClick={() => toggleLibrary(db, { titleId, title: t.title, cover: t.cover })}
          aria-pressed={!!libItem}
          className="min-h-11 rounded-full border border-line px-4 text-sm font-medium"
        >
          {libItem ? "✓ In library" : "+ Library"}
        </button>
      </div>

      {t.summary && (
        <div className="mt-4">
          <p className={`whitespace-pre-line text-sm text-muted ${expanded ? "" : "line-clamp-4"}`}>{t.summary}</p>
          <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs text-accent">
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">{t.chapters.length} chapters</h2>
        <button onClick={() => setDesc((v) => !v)} className="text-sm text-muted">
          {desc ? "Newest first" : "Oldest first"} ⇅
        </button>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {chapters.map((c) => {
          const p = progress?.get(c.id);
          const meta = [c.group, c.date ? new Date(c.date).toLocaleDateString() : undefined].filter(Boolean).join(" · ");
          if (c.externalUrl) {
            return (
              <li key={c.id}>
                <a href={c.externalUrl} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-between py-2 text-sm text-muted">
                  <span>{c.name}</span>
                  <span className="text-xs">Official ↗</span>
                </a>
              </li>
            );
          }
          return (
            <li key={c.id}>
              <Link href={readHref(titleId, c.id)} className={`flex min-h-12 flex-col justify-center py-2 ${p?.completed ? "text-muted" : ""}`}>
                <span className="text-sm">
                  {c.name}
                  {p && !p.completed && <span className="ml-2 text-xs text-accent">{Math.round(p.scrollRatio * 100)}%</span>}
                </span>
                {meta && <span className="text-xs text-muted">{meta}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <Footer />
    </article>
  );
}
