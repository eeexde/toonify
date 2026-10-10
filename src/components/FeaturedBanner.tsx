"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useFeatured } from "@/lib/query/hooks";
import { useLibraryItem } from "@/lib/db/hooks";
import { toggleLibrary } from "@/lib/db/actions";
import { db } from "@/lib/db/schema";
import type { SourceKey } from "@/lib/source/ids";
import type { FeaturedItem } from "@/lib/source/types";
import { buttonPrimary } from "./EmptyState";
import { Icon } from "./icons";
import { StatusChip, titleHref } from "./TitleCard";

const INTERVAL_S = 7;
const SWIPE_PX = 48;

const reducedQuery = "(prefers-reduced-motion: reduce)";
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(reducedQuery);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(reducedQuery).matches,
    () => true,
  );
}

function LibraryButton({ item }: { item: FeaturedItem }) {
  const lib = useLibraryItem(item.id);
  const on = !!lib;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${item.title} from library` : `Add ${item.title} to library`}
      onClick={() => toggleLibrary(db, { titleId: item.id, title: item.title, cover: item.cover })}
      className={`press inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold backdrop-blur-md ${
        on ? "border-accent/60 bg-accent-soft text-accent-text" : "border-white/25 bg-black/25 text-white hover:bg-black/35"
      }`}
    >
      <Icon name={on ? "check" : "plus"} className="h-4 w-4" />
      Library
    </button>
  );
}

function Slide({ item, rank, active }: { item: FeaturedItem; rank: number; active: boolean }) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${rank} of featured: ${item.title}`}
      aria-hidden={!active}
      inert={!active}
      className={`absolute inset-0 transition-opacity duration-700 ease-out-soft ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      {/* Phones: the cover itself is the poster. Desktop: the cover, blurred and slowly drifting, beside the sharp one. */}
      <img
        src={item.cover}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-[50%_20%] motion-safe:animate-[drift_18s_ease-in-out_infinite_alternate] md:hidden"
      />
      <img
        src={item.cover}
        alt=""
        aria-hidden
        className="absolute inset-0 hidden h-full w-full object-cover opacity-80 blur-2xl motion-safe:animate-[drift_18s_ease-in-out_infinite_alternate] md:block"
      />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_85%_10%,rgb(255_178_63/0.28),transparent_55%)]" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0c0910] from-25% via-[#0c0910]/75 via-55% to-transparent md:bg-gradient-to-r md:from-[#0c0910] md:from-0% md:via-[#0c0910]/75 md:via-50% md:to-transparent" />

      <div className="relative flex h-full items-end gap-4 p-5 pb-9 md:items-center md:gap-8 md:p-9">
        <Link
          href={titleHref(item.id)}
          tabIndex={-1}
          aria-hidden
          className={`hidden shrink-0 overflow-hidden rounded-xl shadow-[0_24px_48px_-16px_rgb(0_0_0/0.8)] ring-1 ring-white/15 transition duration-700 ease-out-soft md:block md:w-44 ${
            active ? "rotate-[-2deg] opacity-100 motion-safe:translate-y-0" : "rotate-0 opacity-0 motion-safe:translate-y-4"
          }`}
        >
          <img src={item.cover} alt="" className="aspect-[2/3] w-full object-cover" />
        </Link>
        <div className={`min-w-0 max-w-xl text-white ${active ? "motion-safe:animate-[rise_520ms_var(--ease-out-soft)]" : ""}`}>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffc266]">
            <Icon name="sparkle" className="h-3.5 w-3.5" />
            Featured · #{rank}
          </p>
          <h3 className="display mt-2 line-clamp-2 text-[2.1rem] text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.5)] md:text-[3.25rem]">
            {item.title}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusChip status={item.status} />
            {item.badge && (
              <span className="rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">{item.badge}</span>
            )}
            {item.genres.map((g) => (
              <span key={g} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
                {g}
              </span>
            ))}
          </div>
          {item.summary && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/80 md:line-clamp-3 md:text-[15px]">{item.summary}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href={titleHref(item.id)} className={`${buttonPrimary} shadow-glow`}>
              View series
              <Icon name="forward" className="h-4 w-4" />
            </Link>
            <LibraryButton item={item} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturedBanner({ mature, source, enabled }: { mature: boolean; source: SourceKey; enabled: boolean }) {
  const q = useFeatured(mature, source, enabled);
  const items = q.data ?? [];
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const reduced = useReducedMotion();
  const drag = useRef<{ x: number; y: number } | null>(null);
  const count = items.length;

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [index, count]);

  if (q.isPending && enabled) {
    return (
      <section aria-label="Featured" className="mb-8">
        <div className="skeleton h-[360px] rounded-[28px] md:h-[380px]" />
      </section>
    );
  }
  if (count === 0) return null;

  const autoplay = count > 1 && !reduced && !userPaused;
  const running = autoplay && !hovered && !focused;
  const go = (i: number) => setIndex(((i % count) + count) % count);
  const current = Math.min(index, count - 1);

  return (
    <section
      aria-roledescription="carousel"
      aria-labelledby="featured-h"
      className="mb-8"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocused(false)}
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-text">Trending this month</p>
          <h2 id="featured-h" className="display text-[1.75rem]">Featured</h2>
        </div>
        {count > 1 && (
          <div className="flex items-center gap-1">
            {!reduced && (
              <button
                type="button"
                onClick={() => setUserPaused((v) => !v)}
                aria-label={userPaused ? "Play featured slideshow" : "Pause featured slideshow"}
                className="press flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
              >
                <Icon name={userPaused ? "play" : "pause"} className="h-[18px] w-[18px]" />
              </button>
            )}
            <button type="button" onClick={() => go(current - 1)} aria-label="Previous featured" className="press flex h-11 w-11 items-center justify-center rounded-full border border-line-strong/50 text-fg hover:bg-surface-2">
              <Icon name="back" className="h-[18px] w-[18px]" />
            </button>
            <button type="button" onClick={() => go(current + 1)} aria-label="Next featured" className="press flex h-11 w-11 items-center justify-center rounded-full border border-line-strong/50 text-fg hover:bg-surface-2">
              <Icon name="forward" className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div
          aria-live={running ? "off" : "polite"}
          className="relative h-[360px] touch-pan-y overflow-hidden rounded-[28px] border border-white/10 bg-[#0c0910] shadow-card md:h-[380px]"
          onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (!d) return;
            const dx = e.clientX - d.x;
            if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - d.y)) go(current + (dx < 0 ? 1 : -1));
          }}
        >
          {items.map((it, i) => (
            <Slide key={it.id} item={it} rank={i + 1} active={i === current} />
          ))}
          {autoplay && (
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
              <span
                key={current}
                onAnimationEnd={() => go(current + 1)}
                style={{ animationDuration: `${INTERVAL_S}s`, animationPlayState: running ? "running" : "paused" }}
                className="block h-full origin-left animate-[fill_linear_forwards] bg-accent"
              />
            </span>
          )}
        </div>

        {/* The list: numbered on desktop, a thumbnail strip on phones. */}
        <ol aria-label="Featured titles" className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 md:mx-0 md:max-h-[380px] md:flex-col md:gap-1 md:overflow-y-auto md:px-0 md:pb-6 md:[mask-image:linear-gradient(to_bottom,black_82%,transparent)]">
          {items.map((it, i) => {
            const on = i === current;
            return (
              <li key={it.id} className="shrink-0 md:shrink">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={on ? "true" : undefined}
                  aria-label={`Show ${it.title}`}
                  className={`press group flex w-[76px] flex-col items-center gap-1.5 rounded-2xl text-left md:w-full md:flex-row md:gap-3 md:p-1.5 md:pr-3 ${
                    on ? "md:bg-accent-soft" : "md:hover:bg-surface-2"
                  }`}
                >
                  <span className="relative block w-full md:w-auto">
                    <img
                      src={it.cover}
                      alt=""
                      loading="lazy"
                      className={`aspect-[2/3] w-full rounded-xl bg-surface-2 object-cover ring-2 transition md:w-11 md:rounded-lg ${
                        on ? "ring-accent" : "ring-transparent opacity-70 group-hover:opacity-100 md:opacity-100"
                      }`}
                    />
                    <span className={`display absolute -left-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm md:hidden ${on ? "bg-accent text-accent-fg" : "bg-card text-fg ring-1 ring-line"}`}>
                      {i + 1}
                    </span>
                  </span>
                  <span className={`display hidden w-7 shrink-0 text-center text-[1.6rem] md:block ${on ? "text-accent-text" : "text-muted"}`}>{i + 1}</span>
                  <span className="hidden min-w-0 flex-1 md:block">
                    <span className={`line-clamp-1 text-sm font-bold ${on ? "text-fg" : "text-fg/90"}`}>{it.title}</span>
                    <span className="line-clamp-1 text-xs text-muted">{it.genres.join(" · ") || " "}</span>
                  </span>
                  <span className="line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight text-muted md:hidden">{it.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
