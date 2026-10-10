"use client";
import { useEffect, useRef, useState } from "react";
import { effectiveRatings, hasFilters, RATINGS, type Filters, type Rating, type SortKey, type Tag } from "@/lib/source/filters";
import { buttonPrimary } from "./EmptyState";
import { Icon } from "./icons";

const SORT_LABEL: Record<SortKey, string> = {
  latest: "Latest update",
  relevance: "Best match",
  follows: "Most followed",
  newest: "Newly added",
  title: "A–Z",
};

const RATING_LABEL: Record<Rating, string> = {
  safe: "Safe",
  suggestive: "Suggestive",
  erotica: "Erotica",
  pornographic: "Pornographic",
};

const GROUP_ORDER = ["genre", "theme", "format", "content"];
const GROUP_LABEL: Record<string, string> = { genre: "Genres", theme: "Themes", format: "Format", content: "Content" };

const chip = (on: boolean) =>
  `press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold ${
    on ? "border-accent bg-accent-soft text-accent-text" : "border-line-strong/50 bg-card text-fg hover:bg-surface-2"
  }`;

function sortOptions(searching: boolean): SortKey[] {
  return searching ? ["relevance", "latest", "follows", "newest", "title"] : ["latest", "follows", "newest", "title"];
}

/** Sort select, Filters button and removable chips for the active filters. */
export function FilterBar({
  filters,
  tags,
  mature,
  searching,
  onChange,
}: {
  filters: Filters;
  tags: Tag[];
  mature: boolean;
  searching: boolean;
  onChange: (f: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const sort = filters.sort ?? (searching ? "relevance" : "latest");
  const shownRatings = (filters.ratings ?? []).filter((r) => effectiveRatings(mature).includes(r));
  const count = (filters.tags?.length ?? 0) + shownRatings.length;
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? id;
  const without = <K extends "tags" | "ratings">(key: K, value: string): Filters => {
    const rest = (filters[key] as string[] | undefined)?.filter((v) => v !== value);
    return { ...filters, [key]: rest?.length ? rest : undefined };
  };

  return (
    <div className="mb-4">
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={chip(count > 0)}>
          <Icon name="filter" className="h-4 w-4" />
          Filters
          {count > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] leading-[18px] text-accent-fg">{count}</span>}
        </button>
        <label className={`${chip(!!filters.sort)} relative pr-8`}>
          <span className="sr-only">Sort</span>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value as SortKey })}
            className="cursor-pointer appearance-none bg-transparent outline-none"
          >
            {sortOptions(searching).map((k) => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
          <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 h-4 w-4" />
        </label>
        {filters.tags?.map((id) => (
          <button key={id} type="button" onClick={() => onChange(without("tags", id))} aria-label={`Remove ${tagName(id)}`} className={chip(true)}>
            {tagName(id)}
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        ))}
        {shownRatings.map((r) => (
          <button key={r} type="button" onClick={() => onChange(without("ratings", r))} aria-label={`Remove ${RATING_LABEL[r]}`} className={chip(true)}>
            {RATING_LABEL[r]}
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        ))}
        {hasFilters(filters) && (
          <button type="button" onClick={() => onChange({})} className="press min-h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold text-muted hover:text-fg">
            Clear all
          </button>
        )}
      </div>
      {open && (
        <FilterSheet
          initial={filters}
          tags={tags}
          mature={mature}
          searching={searching}
          onClose={() => setOpen(false)}
          onApply={(f) => {
            setOpen(false);
            onChange(f);
          }}
        />
      )}
    </div>
  );
}

function FilterSheet({
  initial,
  tags,
  mature,
  searching,
  onClose,
  onApply,
}: {
  initial: Filters;
  tags: Tag[];
  mature: boolean;
  searching: boolean;
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState<Filters>(initial);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, []);

  const toggle = <K extends "tags" | "ratings">(key: K, value: string) => {
    const cur = (draft[key] as string[] | undefined) ?? [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    setDraft({ ...draft, [key]: next.length ? next : undefined });
  };
  const groups = GROUP_ORDER.map((g) => ({ g, items: tags.filter((t) => t.group === g) }))
    .concat([{ g: "other", items: tags.filter((t) => !GROUP_ORDER.includes(t.group)) }])
    .filter((x) => x.items.length > 0);
  const allowedRatings = RATINGS.filter((r) => effectiveRatings(mature).includes(r));
  const sort = draft.sort ?? (searching ? "relevance" : "latest");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="filters-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-[2px] motion-safe:animate-[fade_160ms_ease-out] sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[22px] border border-line bg-card shadow-card motion-safe:animate-[rise_220ms_var(--ease-out-soft)] sm:rounded-[22px]"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 id="filters-title" className="display text-[1.9rem]">Filters</h2>
          <button type="button" aria-label="Close filters" onClick={onClose} className="press -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-fg">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-4">
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Sort by</legend>
            <div role="radiogroup" aria-label="Sort by" className="flex flex-wrap gap-2">
              {sortOptions(searching).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={sort === k} onClick={() => setDraft({ ...draft, sort: k })} className={chip(sort === k)}>
                  {SORT_LABEL[k]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Content rating</legend>
            <p className="mb-2 text-xs text-muted">{mature ? "None selected shows all." : "None selected shows all. Turn on 18+ in Settings for mature ratings."}</p>
            <div className="flex flex-wrap gap-2">
              {allowedRatings.map((r) => {
                const on = !!draft.ratings?.includes(r);
                return (
                  <button key={r} type="button" aria-pressed={on} onClick={() => toggle("ratings", r)} className={chip(on)}>
                    {on && <Icon name="check" className="h-3.5 w-3.5" />}
                    {RATING_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {groups.map(({ g, items }) => (
            <fieldset key={g}>
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{GROUP_LABEL[g] ?? "Other"}</legend>
              <div className="flex flex-wrap gap-2">
                {items.map((t) => {
                  const on = !!draft.tags?.includes(t.id);
                  return (
                    <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle("tags", t.id)} className={chip(on)}>
                      {on && <Icon name="check" className="h-3.5 w-3.5" />}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={() => setDraft({})} className="press min-h-11 rounded-full px-4 text-sm font-semibold text-fg hover:bg-surface-2">
            Reset
          </button>
          <button type="button" onClick={() => onApply(draft)} className={`${buttonPrimary} ml-auto`}>
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
