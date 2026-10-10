"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useHistory, useLibrary } from "@/lib/db/hooks";
import { readHref, TitleCard } from "@/components/TitleCard";
import { TitleGrid } from "@/components/TitleGrid";
import { buttonPrimary, EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/icons";

const TABS = ["library", "history"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { library: "Saved", history: "History" };

function when(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString();
}

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>("library");
  const library = useLibrary();
  const history = useHistory();
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ library: null, history: null });
  const counts: Record<Tab, number | undefined> = { library: library?.length, history: history?.length };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = tab === "library" ? "history" : "library";
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <h1 className="display mb-4 text-[2.25rem] md:text-[2.75rem]">Library</h1>
      <div role="tablist" aria-label="Library sections" onKeyDown={onKey} className="mb-6 inline-flex rounded-full border border-line bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[t] = el;
            }}
            id={`tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={`press flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold ${
              tab === t ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
            }`}
          >
            {TAB_LABEL[t]}
            {counts[t] !== undefined && counts[t]! > 0 && (
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${tab === t ? "bg-accent-fg/15" : "bg-surface-2"}`}>{counts[t]}</span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "library" ? (
          library?.length === 0 ? (
            <EmptyState
              icon="bookmark"
              title="Your library is empty."
              body="Add titles from their page and they will wait for you here, with a mark when new chapters land."
              action={<Link href="/" className={buttonPrimary}>Browse latest updates</Link>}
            />
          ) : (
            <TitleGrid>
              {library?.map((l) => (
                <TitleCard
                  key={l.titleId}
                  item={{ id: l.titleId, title: l.title, cover: l.cover }}
                  dot={!!l.latestChapterId && l.latestChapterId !== l.lastChapterSeenId}
                />
              ))}
            </TitleGrid>
          )
        ) : history?.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Nothing read yet."
            body="Chapters you open show up here, so you can pick up where you left off."
            action={<Link href="/" className={buttonPrimary}>Find something to read</Link>}
          />
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 md:gap-3">
            {history?.map((h) => (
              <li key={h.titleId}>
                <a href={readHref(h.titleId, h.chapterId)} className="press group flex items-center gap-3 rounded-2xl border border-line bg-card p-2 pr-3 hover:border-line-strong/70">
                  <img src={h.cover} alt="" className="h-[72px] w-12 shrink-0 rounded-lg bg-surface-2 object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{h.title}</span>
                    <span className="block truncate text-sm text-muted">{h.chapterName}</span>
                    <span className="block text-xs text-muted">{when(h.readAt)}</span>
                  </span>
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                    <Icon name="forward" className="h-4 w-4" strokeWidth={2.4} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
