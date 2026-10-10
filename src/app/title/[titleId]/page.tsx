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
import type { ProgressItem } from "@/lib/db/types";
import { readHref } from "@/components/TitleCard";
import { ErrorState } from "@/components/ErrorState";
import { Footer } from "@/components/Footer";
import { Icon } from "@/components/icons";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One node on the chapter spine: lit when read, a ring with an arc when in progress. */
function SpineNode({ p, external }: { p?: ProgressItem; external?: boolean }) {
  if (external) {
    return (
      <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line-strong bg-bg text-muted">
        <Icon name="external" className="h-3 w-3" />
      </span>
    );
  }
  if (p?.completed) {
    return (
      <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-fg">
        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
      </span>
    );
  }
  if (p) {
    const deg = Math.round(p.scrollRatio * 360);
    return (
      <span
        className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(var(--accent) ${deg}deg, var(--surface-2) 0)` }}
      >
        <span className="h-4 w-4 rounded-full bg-bg" />
      </span>
    );
  }
  return (
    <span className="relative z-10 flex h-6 w-6 items-center justify-center">
      <span className="h-2.5 w-2.5 rounded-full border-2 border-line-strong bg-bg" />
    </span>
  );
}

function TitleSkeleton() {
  return (
    <div role="status" aria-label="Loading title">
      <div className="grid grid-cols-[112px_1fr] gap-4 md:grid-cols-[224px_1fr] md:gap-8">
        <div className="skeleton aspect-[2/3] rounded-cover" />
        <div className="space-y-3 pt-2">
          <div className="skeleton h-8 w-4/5 rounded-lg" />
          <div className="skeleton h-3 w-1/2 rounded-full" />
          <div className="flex gap-2 pt-2">
            <div className="skeleton h-6 w-16 rounded-full" />
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="skeleton mt-6 h-12 rounded-full md:max-w-md" />
      <div className="mt-10 space-y-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-4 rounded-full" style={{ width: `${70 - i * 6}%` }} />
        ))}
      </div>
    </div>
  );
}

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
  if (q.isPending) return <TitleSkeleton />;
  if (q.isError || !t) return <ErrorState message={q.error?.message ?? "Failed to load."} onRetry={() => q.refetch()} />;

  const chapters = desc ? [...t.chapters].reverse() : t.chapters;
  const resume = hist && readable.some((c) => c.id === hist.chapterId) ? hist : null;
  const first = readable[0];
  const people = [...new Set([...t.authors, ...t.artists])];
  const readCount = readable.filter((c) => progress?.get(c.id)?.completed).length;

  return (
    <article className="relative isolate">
      {/* Backdrop: the cover, blurred into the page like lamplight through paper. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[calc(-1*max(1rem,env(safe-area-inset-top)))] -z-10 h-[400px] w-screen -translate-x-1/2 overflow-hidden md:-top-8 md:h-[460px]"
      >
        <img src={t.cover} alt="" className="h-full w-full scale-125 object-cover opacity-50 blur-3xl saturate-150" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/75 to-bg" />
      </div>

      <div className="grid grid-cols-[112px_1fr] gap-x-4 gap-y-5 pt-2 [grid-template-areas:'cover_meta'_'cta_cta'_'sum_sum'] md:grid-cols-[224px_1fr] md:gap-x-10 md:gap-y-6 md:pt-4 md:[grid-template-areas:'cover_meta'_'cover_cta'_'cover_sum'] md:[grid-template-rows:auto_auto_1fr]">
        <img
          src={t.cover}
          alt=""
          className="aspect-[2/3] w-full self-start rounded-cover bg-surface-2 object-cover shadow-card ring-1 ring-white/10 [grid-area:cover]"
        />

        <div className="min-w-0 self-end [grid-area:meta] md:self-end">
          {t.status && (
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-text">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
              {capitalize(t.status)}
            </p>
          )}
          <h1 className="display text-[2.1rem] [overflow-wrap:anywhere] md:text-[3.5rem]">{t.title}</h1>
          {people.length > 0 && <p className="mt-2 line-clamp-2 text-sm text-muted">{people.join(", ")}</p>}
          {t.genres.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Genres">
              {t.genres.slice(0, 8).map((g) => (
                <li key={g} className="rounded-full border border-line bg-card/60 px-2.5 py-1 text-xs font-medium text-muted">{g}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2 [grid-area:cta] md:max-w-lg">
          {resume ? (
            <Link
              href={readHref(titleId, resume.chapterId)}
              className="press flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 font-bold text-accent-fg shadow-glow hover:brightness-105"
            >
              <span className="truncate">Continue {resume.chapterName}</span>
            </Link>
          ) : first ? (
            <Link
              href={readHref(titleId, first.id)}
              className="press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 font-bold text-accent-fg shadow-glow hover:brightness-105"
            >
              Start reading
            </Link>
          ) : (
            <p className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-dashed border-line-strong px-4 text-sm text-muted">
              No chapters readable here
            </p>
          )}
          <button
            onClick={() => toggleLibrary(db, { titleId, title: t.title, cover: t.cover })}
            aria-pressed={!!libItem}
            className={`press min-h-12 shrink-0 rounded-full border px-5 text-sm font-bold ${
              libItem ? "border-accent/50 bg-accent-soft text-accent-text" : "border-line-strong/70 bg-card text-fg hover:bg-surface-2"
            }`}
          >
            {libItem ? "✓ In library" : "+ Library"}
          </button>
        </div>

        {t.summary && (
          <div className="[grid-area:sum] md:max-w-[65ch]">
            <p id="summary" className={`whitespace-pre-line text-[15px] leading-relaxed text-fg/85 ${expanded ? "" : "line-clamp-3 md:line-clamp-5"}`}>
              {t.summary}
            </p>
            {(t.summary.length > 160 || t.summary.includes("\n")) && (
              <button
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-controls="summary"
                className="press -ml-2 mt-1 min-h-11 rounded-full px-2 text-sm font-bold text-accent-text"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>

      <section aria-labelledby="chapters-h" className="mt-10 md:max-w-3xl">
        <div className="flex items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 id="chapters-h" className="display text-[1.75rem]">{t.chapters.length} chapters</h2>
            {readCount > 0 && (
              <p className="mt-1 text-xs text-muted">
                {readCount} of {readable.length} read
              </p>
            )}
          </div>
          <button
            onClick={() => setDesc((v) => !v)}
            className="press -mr-2 flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Icon name="sort" className="h-4 w-4" />
            {desc ? "Newest first" : "Oldest first"}
          </button>
        </div>

        {/* The spine: one continuous line through every chapter node, lit where you have read. */}
        <ol className="relative mt-1 before:absolute before:bottom-6 before:left-[11px] before:top-6 before:w-0.5 before:rounded-full before:bg-line">
          {chapters.map((c) => {
            const p = progress?.get(c.id);
            const isLast = resume?.chapterId === c.id;
            const meta = [c.group, c.date ? new Date(c.date).toLocaleDateString() : undefined].filter(Boolean).join(" · ");
            if (c.externalUrl) {
              return (
                <li key={c.id}>
                  <a
                    href={c.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex min-h-14 items-center gap-4 py-2 text-sm text-muted"
                  >
                    <SpineNode external />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-semibold group-hover:border-line-strong group-hover:text-fg">Official ↗</span>
                  </a>
                </li>
              );
            }
            return (
              <li key={c.id}>
                <Link
                  href={readHref(titleId, c.id)}
                  aria-current={isLast ? "true" : undefined}
                  className={`group -mx-2 flex min-h-14 items-center gap-4 rounded-xl px-2 py-2 hover:bg-card ${isLast ? "bg-accent-soft hover:bg-accent-soft" : ""}`}
                >
                  <SpineNode p={p} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate text-[15px] ${p?.completed ? "text-muted" : "font-semibold text-fg"}`}>{c.name}</span>
                    {meta && <span className="truncate text-xs text-muted">{meta}</span>}
                  </span>
                  {isLast ? (
                    <span className="shrink-0 text-xs font-bold text-accent-text">
                      Last read{p && !p.completed ? ` · ${Math.round(p.scrollRatio * 100)}%` : ""}
                    </span>
                  ) : (
                    p && !p.completed && <span className="shrink-0 text-xs font-bold tabular-nums text-accent-text">{Math.round(p.scrollRatio * 100)}%</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
      <Footer />
    </article>
  );
}
