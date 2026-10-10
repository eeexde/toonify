# Manga support — design

Date: 2026-10-11
Status: approved in chat, pending spec review

## Goal

Toonify is a manhwa reader today: MangaDex browse/search is locked to Korean originals and the reader is a vertical long strip. Add manga (Japanese originals) **alongside** manhwa:

- A `Manga | Manhwa` toggle switches the whole catalog (grid, search, featured banner).
- **Manga is the default** catalog; manhwa sits behind the toggle.
- Manga is read in a new **paged reader** (one page at a time, right-to-left by default).
- Readers can override the reader mode per title; the choice is remembered.

Manhwa browsing and the long-strip reader keep working exactly as they do now.

## Non-goals

- Mixed "All" catalog view, or a manga badge on cards (grids are never mixed).
- Manhua (Chinese originals).
- Two-page desktop spreads, custom zoom (native pinch-zoom only).
- Manga on ScraperGo/Toonily (it has none).

## 1. Catalog and data

### `kind` filter

- `src/lib/source/filters.ts`: add `kind?: "manga" | "manhwa"` to `Filters`, plus `KINDS` const and `effectiveKind(f) => f.kind ?? "manga"`.
- `parseFilters` reads `kind`; an unknown value is invalid (returns null, as other filters do).
- `filtersToSearch` writes `kind` only when it is `manhwa`, so manga URLs stay clean (`/` = manga, `/?kind=manhwa` = manhwa).
- `filtersKey` adds `k=manhwa` only for manhwa (so client query keys and unfiltered URLs stay clean). `SourceService` puts the effective kind into **every** list and featured cache key (`v1:md:home:manga:1:0`), so today's Korean-only entries are never served as manga and simply expire.
- `hasFilters` ignores `kind` (the toggle is not a "filter is active" state for the clear-filters UI).

### MangaDex

- `listParams` sends `originalLanguage[]=ja` for manga, `ko` for manhwa. Everything else unchanged.
- `featured` takes the kind and passes it through `listParams`.
- `SourceService.featured` takes `filters`/kind and adds it to its cache key; `/api/featured` accepts `kind` (validated via `parseFilters`), and the client featured query passes it.

### ScraperGo (Toonily)

Manhwa-only. When `kind` is `manga` and the source is `sg`, `SourceService` returns an empty page without calling upstream, and the UI shows an empty state: "Manga isn't available on Toonily. Switch source in Settings." Manhwa unchanged.

### Title layout

- `Title` gains `layout: "strip" | "paged"`.
- MangaDex `toTitle`: `strip` if `originalLanguage` is `ko`, or the title carries the MangaDex "Long Strip" format tag; otherwise `paged`. The tag schema must expose the tag name/id (it already includes `name` and `group`).
- ScraperGo and mock sources: `strip` (mock gets Japanese fixtures with `paged`, see Testing).

### UI and copy

- Home/search: segmented `[ Manga | Manhwa ]` toggle before sort/tags in `Filters.tsx`, driven by `browseHref`. The featured banner follows it.
- Copy: "manhwa reader" → "manhwa & manga reader" (`layout.tsx`, `manifest.ts`); search placeholder/label "Search manhwa" → "Search titles".
- Library, history and progress need no migration: title ids are unchanged.

## 2. Paged reader

### Structure

`Reader.tsx` becomes a shell that keeps loading/error states, the overlay, history recording and `[`/`]` chapter keys, and renders by mode:

- `StripView` — today's vertical strip, moved out unchanged.
- `PagedView` — new.
- `EndCard` — the end-of-chapter section, extracted and shared. In paged mode it is the "page" after the last image.

### PagedView

- One page fitted to the viewport (`h-dvh`, `object-contain`) on black. Reuses `ReaderPage` with a new `fit` prop so loading/error/retry behaviour stays identical.
- Navigation:
  - Tap zones: outer thirds turn pages, centre toggles the overlay (extends existing `onTap`). In RTL the left third is "next"; in LTR the right third is.
  - Horizontal swipe via pointer events: > 50px and mostly horizontal turns the page.
  - Arrow keys follow reading direction. `[`/`]` still jump chapters.
  - Forward from the last page shows `EndCard`; back from page 1 does nothing.
- Preload: current page ±2 via `new Image()`. Next-chapter prefetch uses the existing `onPrefetch` at the same 70% threshold.

### Progress tracking

`createTracker` (`src/lib/reader/progress.ts`) only reads `measure()`, so it is reused as-is. Paged mode feeds it `{ y: pageIndex, pageIndex, ratio: (i + 1) / n }` on every page change:

- Saves, prefetch (0.7) and completion (0.95) thresholds and the overlay progress bar work unchanged.
- "Scroll down" becomes "page forward", which hides the overlay.
- Restore opens at the saved `pageIndex` instead of scrolling to it.
- `ProgressItem` is unchanged, so progress survives a mode switch in either direction.

The paged-mode wiring lives in its own hook (`usePagedTracking`) beside `useReaderTracking`, sharing `createTracker`.

## 3. Per-title override and storage

- Reader overlay gets a mode switch: **Long strip**, **Paged right-to-left**, **Paged left-to-right**.
- Default mode: `layout === "strip"` → Long strip; `paged` → Paged right-to-left.
- Choice is stored in a new Dexie table `titlePrefs` (`titleId` primary key, `{ titleId, mode }`) via schema `version(2)`. Additive: no existing table changes.
- Backup: `titlePrefs` is an **optional** array in `BackupSchema` (still `version: 1`), so old backups keep importing. Validated with a zod enum for `mode`, capped like the other arrays.

## Testing (TDD)

Unit (vitest):

- `kind`: parse, invalid value rejected, URL round-trip, `filtersKey` always includes the effective kind, default is manga.
- `listParams`: `ja` for manga/default, `ko` for manhwa; featured passes kind.
- `SourceService`: ScraperGo + manga returns empty without an upstream call; featured cache key includes kind.
- `layout` derivation: `ja` → paged, `ko` → strip, `ja` + Long Strip tag → strip.
- Paged `measure` driving the tracker: prefetch, complete and save fire at the right pages.
- Backup round-trip with `titlePrefs`; old backup without it still imports.

Mock fixtures: add Japanese titles (`paged`), keep existing ones as manhwa.

e2e (Playwright, mock mode):

- Home opens on manga; toggle switches to manhwa and back.
- Paged RTL reader: tap zones and arrow keys turn pages; end card after the last page.
- Mode override persists across reload.
- Existing manhwa specs pass via `?kind=manhwa` (search label updated to "Search titles").
