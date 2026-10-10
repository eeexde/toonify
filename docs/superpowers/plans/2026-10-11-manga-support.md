# Manga Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manga (Japanese originals) alongside manhwa, with a `Manga | Manhwa` catalog toggle defaulting to manga, and a paged right-to-left reader with a per-title mode override.

**Architecture:** A new `kind` filter flows through the existing filter plumbing (URL → API route → `SourceService` cache key → source query). Titles carry a `layout` hint; the reader resolves a `ReaderMode` from a per-title Dexie pref or that hint and renders either the existing strip view or a new paged view. Paged progress reuses the DOM-free `createTracker` by feeding it page-index measurements.

**Tech Stack:** Next.js 15 (app router), React 19, TanStack Query, Dexie, zod, Tailwind 4, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-manga-support-design.md`

## Global Constraints

- Default catalog kind is `manga`. A URL without `kind` means manga; only `kind=manhwa` is ever written to URLs.
- MangaDex language mapping: manga → `originalLanguage[]=ja`, manhwa → `originalLanguage[]=ko`.
- ScraperGo (`sg`) supports only `manhwa`; `manga` on `sg` returns an empty page without an upstream call.
- Server list/featured cache keys always contain the effective kind (old Korean-only keys must never be served as manga).
- Reader modes: `"strip" | "paged-rtl" | "paged-ltr"`. Default: `layout === "paged"` → `paged-rtl`, otherwise `strip` (including a missing `layout`).
- MangaDex layout: `ko` → `strip`; a tag with group `format` and English name `Long Strip` → `strip`; otherwise `paged`.
- Swipe threshold 50px, mostly horizontal. Preload current page ±2. Prefetch/complete thresholds unchanged (0.7 / 0.95).
- Backup stays `version: 1`; `titlePrefs` is optional.
- Copy: "A fast, mobile-first manhwa & manga reader."; search field placeholder and aria-label "Search titles".
- Run unit tests with `npx vitest run <path>`; e2e with `npx playwright test <file>` (mock mode server on port 3100 is started by the config).

## Review Focus

1. **"Clear filters" / "Clear all" / "Reset" while on manhwa** — the user expects to stay on manhwa, not be thrown back to manga. Pinned by `clearFilters` tests in Task 1 and the e2e in Task 5.
2. **Title cached before this change (no `layout`)** — Upstash/LRU and the persisted React Query cache hold titles without `layout`; the reader must treat that as `strip`, not crash or go paged. Pinned by `resolveMode` tests in Task 6.
3. **Header search typed while browsing manhwa** — results must stay in manhwa (HeaderSearch already keeps home filters; `kind` must survive `browseHref`). Pinned by browse tests in Task 1 and e2e in Task 5.
4. **Saved paged position beyond the chapter length** (chapter re-uploaded with fewer pages, or progress written by strip mode) — restore must clamp, not show a blank page. Pinned by `clampRestore` tests in Task 7.
5. **Swipe that also fires a click** — a horizontal swipe must turn exactly one page, not one page plus a tap-zone turn. Pinned by the swipe-suppression e2e in Task 9.

---

## File Map

| File | Responsibility | Task |
|---|---|---|
| `src/lib/source/filters.ts` | `Kind`, `effectiveKind`, `clearFilters`, `sourceSupportsKind`, kind in parse/key/URL | 1 |
| `src/lib/source/types.ts` | `Layout`, `Title.layout`, `featured` opts gain `kind` | 2 |
| `src/lib/source/mock/fixtures.ts`, `mock/index.ts` | Manga fixtures, kind filtering, mock layout | 2 |
| `src/lib/source/mangadex/{schemas,normalize,index}.ts` | `originalLanguage`, `layoutOf`, language per kind | 3 |
| `src/lib/source/scrapergo/normalize.ts` | `layout: "strip"` | 3 |
| `src/lib/source/service.ts`, `src/app/api/featured/route.ts` | Kind in cache keys, unsupported kind → empty | 4 |
| `src/lib/query/hooks.ts`, `src/components/KindToggle.tsx`, `src/components/FeaturedBanner.tsx`, `src/components/Filters.tsx`, `src/app/page.tsx`, `src/components/HeaderSearch.tsx`, `src/app/layout.tsx`, `src/app/manifest.ts` | Toggle UI, featured kind, copy | 5 |
| `src/lib/reader/mode.ts` | `ReaderMode`, `resolveMode`, `tapAction`, `keyAction`, `swipeAction` | 6 |
| `src/lib/db/{types,schema,actions,hooks,backup}.ts` | `titlePrefs` table, `setReaderMode`, `useTitlePref`, backup | 6 |
| `src/lib/reader/progress.ts`, `src/components/reader/usePagedTracking.ts` | `pagedMeasure`, `clampRestore`, paged tracker hook | 7 |
| `src/components/reader/{Reader,StripView,EndCard}.tsx` | Shell split, no behaviour change | 8 |
| `src/components/reader/{PagedView,ReaderPage,ReaderOverlay,Reader}.tsx` | Paged reader, `fit`, mode switch | 9 |

---

### Task 1: `kind` filter

**Files:**
- Modify: `src/lib/source/filters.ts`
- Test: `tests/unit/source/filters.test.ts`, `tests/unit/query/browse.test.ts`

**Interfaces:**
- Produces:
  - `KINDS: readonly ["manga", "manhwa"]`, `type Kind`, `DEFAULT_KIND: Kind = "manga"`
  - `Filters.kind?: Kind` (only ever `"manhwa"` after `parseFilters`; `"manga"` is normalised away)
  - `effectiveKind(f: { kind?: Kind }): Kind`
  - `clearFilters(f: Filters): Filters` — drops everything except a non-default kind
  - `sourceSupportsKind(source: SourceKey, kind: Kind): boolean`
  - `filtersKey` appends `k=manhwa` only for manhwa; `filtersToSearch` writes `kind=manhwa` first; `hasFilters` ignores kind.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/source/filters.test.ts` (and add `clearFilters, effectiveKind, hasFilters, sourceSupportsKind` to its import from `@/lib/source/filters`):

```ts
describe("kind", () => {
  test("defaults to manga; manga is normalised away, manhwa kept", () => {
    expect(effectiveKind({})).toBe("manga");
    expect(parseFilters(sp("kind=manga"))).toEqual({});
    expect(parseFilters(sp("kind=manhwa"))).toEqual({ kind: "manhwa" });
    expect(effectiveKind(parseFilters(sp("kind=manhwa"))!)).toBe("manhwa");
  });
  test("rejects unknown kind", () => {
    expect(parseFilters(sp("kind=manhua"))).toBeNull();
  });
  test("key and URL: only manhwa is written; round trips", () => {
    expect(filtersKey({})).toBe("");
    expect(filtersKey({ kind: "manga" })).toBe("");
    expect(filtersKey({ kind: "manhwa", sort: "title" })).toBe("s=title;k=manhwa");
    expect(filtersToSearch({ kind: "manhwa", tags: ["action"] })).toBe("kind=manhwa&tags=action");
    expect(filtersToSearch({ kind: "manga" })).toBe("");
    const f = { kind: "manhwa" as const, sort: "follows" as const };
    expect(parseFilters(new URLSearchParams(filtersToSearch(f)))).toEqual(f);
  });
  test("kind alone is not an active filter", () => {
    expect(hasFilters({ kind: "manhwa" })).toBe(false);
  });
  test("clearFilters keeps a non-default kind only", () => {
    expect(clearFilters({ kind: "manhwa", sort: "title", tags: ["a"], ratings: ["safe"] })).toEqual({ kind: "manhwa" });
    expect(clearFilters({ sort: "title" })).toEqual({});
  });
  test("ScraperGo is manhwa-only", () => {
    expect(sourceSupportsKind("sg", "manga")).toBe(false);
    expect(sourceSupportsKind("sg", "manhwa")).toBe(true);
    expect(sourceSupportsKind("md", "manga")).toBe(true);
    expect(sourceSupportsKind("mock", "manga")).toBe(true);
  });
});
```

Append to `tests/unit/query/browse.test.ts` inside `describe("browse urls", ...)`:

```ts
  test("kind survives browseHref and reaches the API", () => {
    expect(browseHref("bak", { kind: "manhwa" })).toBe("/?q=bak&kind=manhwa");
    expect(browseHref("", { kind: "manhwa" })).toBe("/?kind=manhwa");
    expect(readBrowse(new URLSearchParams("q=bak&kind=manhwa"))).toEqual({ q: "bak", filters: { kind: "manhwa" } });
    expect(browseApiPath({ q: "", filters: { kind: "manhwa" }, page: 1, mature: false, source: "md" })).toBe("/api/home?page=1&mature=0&source=md&kind=manhwa");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/source/filters.test.ts tests/unit/query/browse.test.ts`
Expected: FAIL — `effectiveKind is not a function` / import errors.

- [ ] **Step 3: Implement**

In `src/lib/source/filters.ts`:

Add at the top, after the header comment:

```ts
import type { SourceKey } from "./ids";
```

After the `RATINGS` / `MATURE_RATINGS` block add:

```ts
export const KINDS = ["manga", "manhwa"] as const;
export type Kind = (typeof KINDS)[number];
export const DEFAULT_KIND: Kind = "manga";

/** Which catalog kinds each source can list. */
const SOURCE_KINDS: Record<SourceKey, readonly Kind[]> = { md: KINDS, sg: ["manhwa"], mock: KINDS };

export const sourceSupportsKind = (source: SourceKey, kind: Kind) => SOURCE_KINDS[source].includes(kind);

export const effectiveKind = (f: { kind?: Kind }): Kind => f.kind ?? DEFAULT_KIND;
```

Change `Filters`:

```ts
export interface Filters {
  /** Catalog kind; absent means DEFAULT_KIND. parseFilters never stores the default. */
  kind?: Kind;
  sort?: SortKey;
  tags?: string[];
  ratings?: Rating[];
}
```

Add next to `isSort`/`isRating`:

```ts
const isKind = (s: string): s is Kind => (KINDS as readonly string[]).includes(s);
```

In `parseFilters`, before the `sort` block:

```ts
  const kind = sp.get("kind");
  if (kind) {
    if (!isKind(kind)) return null;
    if (kind !== DEFAULT_KIND) out.kind = kind;
  }
```

Update the `parseFilters` doc comment to: `/** Parse \`kind\`, \`sort\`, \`tags\` (comma list) and \`rating\` (comma list). Returns null when any value is invalid. */`

In `filtersKey`, after the ratings line and before `return`:

```ts
  if (effectiveKind(f) !== DEFAULT_KIND) parts.push(`k=${effectiveKind(f)}`);
```

In `filtersToSearch`, as the first line after `const p = new URLSearchParams();`:

```ts
  if (effectiveKind(f) !== DEFAULT_KIND) p.set("kind", effectiveKind(f));
```

At the end of the file:

```ts
/** "Clear all": drop every filter but stay in the current catalog kind. */
export const clearFilters = (f: Filters): Filters => (effectiveKind(f) === DEFAULT_KIND ? {} : { kind: effectiveKind(f) });
```

(`hasFilters` stays as-is: it already ignores `kind`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/source/filters.test.ts tests/unit/query/browse.test.ts`
Expected: PASS (all, including the pre-existing cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/source/filters.ts tests/unit/source/filters.test.ts tests/unit/query/browse.test.ts
git commit -m "feat: kind filter (manga default, manhwa) in browse filters"
```

---

### Task 2: Types and mock source

**Files:**
- Modify: `src/lib/source/types.ts`, `src/lib/source/mock/fixtures.ts`, `src/lib/source/mock/index.ts`
- Test: `tests/unit/source/mock.test.ts`

**Interfaces:**
- Consumes: `Kind`, `effectiveKind` (Task 1)
- Produces:
  - `type Layout = "strip" | "paged"` in `types.ts`
  - `Title.layout?: Layout` (optional: caches written before this change lack it)
  - `Source.featured?(opts: { mature: boolean; kind?: Kind; now?: () => number })`
  - `MockTitle.kind: Kind`; manga fixtures `delta` ("Paper Lantern") and `epsilon` ("Iron Courier")
  - `MockSource` lists only `effectiveKind(opts)` titles; mock `title().layout` is `"paged"` for manga, `"strip"` for manhwa

- [ ] **Step 1: Write the failing tests**

In `tests/unit/source/mock.test.ts`, existing tests assume the manhwa catalog. Update every `src.home(...)`, `src.search(...)` and `src.featured(...)` options object in the file to include `kind: "manhwa"` (e.g. `{ mature: false }` → `{ mature: false, kind: "manhwa" }`). Change the tags expectation to:

```ts
    expect((await src.tags()).map((t) => t.id)).toEqual(["action", "drama", "fantasy", "romance", "slice-of-life"]);
```

Then append inside `describe("MockSource", ...)`:

```ts
  test("defaults to the manga catalog", async () => {
    expect((await src.home(1, { mature: false })).items.map((i) => i.id)).toEqual(["mock:delta", "mock:epsilon"]);
    expect((await src.search("lantern", 1, { mature: false })).items.map((i) => i.id)).toEqual(["mock:delta"]);
    expect((await src.featured({ mature: false })).map((i) => i.id)).toEqual(["mock:delta", "mock:epsilon"]);
  });
  test("layout follows kind", async () => {
    expect((await src.title("delta")).layout).toBe("paged");
    expect((await src.title("alpha")).layout).toBe("strip");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/source/mock.test.ts`
Expected: FAIL — `mock:delta` missing, `layout` undefined.

- [ ] **Step 3: Implement**

`src/lib/source/types.ts` — add the import and type, extend `Title` and `Source.featured`:

```ts
import type { Filters, Kind, Tag } from "./filters";
```

```ts
/** How a title's pages are meant to be read: a vertical strip (manhwa) or one page at a time (manga). */
export type Layout = "strip" | "paged";
```

In `Title`, after `contentRating?: string;`:

```ts
  /** Absent in titles cached before manga support; readers treat that as "strip". */
  layout?: Layout;
```

Replace the `featured?` member of `Source`:

```ts
  /** Titles for the Home banner. `now` is injectable for tests. */
  featured?(opts: { mature: boolean; kind?: Kind; now?: () => number }): Promise<FeaturedItem[]>;
```

`src/lib/source/mock/fixtures.ts`:

```ts
import type { Kind } from "../filters";

export interface MockTitle {
  slug: string;
  title: string;
  hue: number;
  rating: "safe" | "erotica";
  status: "ongoing" | "completed";
  summary: string;
  genres: string[];
  readable: number;
  external?: number;
  kind: Kind;
}

export const MOCK_TITLES: MockTitle[] = [
  { slug: "alpha", title: "Skyward Blade", hue: 210, rating: "safe", status: "ongoing", summary: "A swordsman climbs the tower.", genres: ["Action", "Fantasy"], readable: 3, external: 4, kind: "manhwa" },
  { slug: "beta", title: "Moonlit Bakery", hue: 30, rating: "safe", status: "completed", summary: "Bread, but at midnight.", genres: ["Slice of Life"], readable: 2, kind: "manhwa" },
  { slug: "gamma", title: "Crimson Night", hue: 350, rating: "erotica", status: "ongoing", summary: "Adults only.", genres: ["Romance"], readable: 2, kind: "manhwa" },
  { slug: "delta", title: "Paper Lantern", hue: 140, rating: "safe", status: "ongoing", summary: "A lamp-maker's apprentice in old Kyoto.", genres: ["Drama", "Fantasy"], readable: 2, kind: "manga" },
  { slug: "epsilon", title: "Iron Courier", hue: 260, rating: "safe", status: "completed", summary: "Deliveries across a drowned Tokyo.", genres: ["Action"], readable: 1, kind: "manga" },
];

export const MOCK_PAGES_PER_CHAPTER = 5;
```

`src/lib/source/mock/index.ts`:
- Change the filters import to `import { effectiveKind, effectiveRatings, type Kind, type Tag } from "../filters";`
- In `visible`, add the kind check:

```ts
  private visible(opts: ListOpts) {
    const ratings = effectiveRatings(opts.mature, opts.ratings);
    const kind = effectiveKind(opts);
    const out = MOCK_TITLES.filter(
      (t) => t.kind === kind && ratings.includes(t.rating) && (opts.tags ?? []).every((id) => t.genres.some((g) => tagId(g) === id)),
    );
```

- Replace `featured`:

```ts
  async featured(opts: { mature: boolean; kind?: Kind }): Promise<FeaturedItem[]> {
    return this.visible({ mature: opts.mature, kind: opts.kind }).map((t) => ({ ...summary(t), summary: t.summary, genres: t.genres }));
  }
```

- In `title()`, after `contentRating: t.rating,` add `layout: t.kind === "manga" ? "paged" : "strip",`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/source/mock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/source/types.ts src/lib/source/mock tests/unit/source/mock.test.ts
git commit -m "feat: title layout type and manga fixtures in the mock source"
```

(`tests/unit/source/service.test.ts` and `tests/unit/api/routes.test.ts` will fail until Task 4; that is expected — do not run the full suite here.)

---

### Task 3: MangaDex and ScraperGo

**Files:**
- Modify: `src/lib/source/mangadex/schemas.ts`, `src/lib/source/mangadex/normalize.ts`, `src/lib/source/mangadex/index.ts`, `src/lib/source/scrapergo/normalize.ts`
- Test: `tests/unit/source/mangadex.test.ts`, `tests/unit/source/scrapergo.test.ts`

**Interfaces:**
- Consumes: `Kind`, `effectiveKind` (Task 1), `Layout` (Task 2)
- Produces: `layoutOf(m: MdManga): Layout` exported from `mangadex/normalize.ts`; `toTitle` sets `layout`; MangaDex list/featured send the kind's language; ScraperGo `toTitle` sets `layout: "strip"`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/source/mangadex.test.ts`:
- In the `manga()` fixture's `attributes`, add `originalLanguage: "ko",` before `...over`.
- In test `"home maps list and builds query"`, change `src.home(1, { mature: false })` to `src.home(1, { mature: false, kind: "manhwa" })` (keeps asserting `ko`).
- Append inside `describe("MangaDexSource", ...)`:

```ts
  test("language follows kind: manga (default) -> ja, manhwa -> ko", async () => {
    const { src, calls } = source({ "/manga?": { result: "ok", data: [], limit: 24, offset: 0, total: 0 } });
    await src.home(1, { mature: false });
    await src.search("x", 1, { mature: false, kind: "manhwa" });
    await src.featured({ mature: false, kind: "manga" });
    expect(calls.map((c) => new URL(c).searchParams.getAll("originalLanguage[]"))).toEqual([["ja"], ["ko"], ["ja"]]);
  });

  test("layout: ko strip, ja paged, ja with Long Strip tag strip", async () => {
    const longStrip = { attributes: { name: { en: "Long Strip" }, group: "format" } };
    const feed = { result: "ok", data: [], limit: 500, offset: 0, total: 0 };
    const cases: [Record<string, unknown>, string][] = [
      [{}, "strip"],
      [{ originalLanguage: "ja" }, "paged"],
      [{ originalLanguage: "ja", tags: [longStrip] }, "strip"],
    ];
    for (const [over, layout] of cases) {
      const { src } = source({ [`/manga/${MID}?`]: { result: "ok", data: manga(over) }, "/feed?": feed });
      expect((await src.title(MID)).layout).toBe(layout);
    }
  });
```

In `tests/unit/source/scrapergo.test.ts`, in the test containing `const t = await src.title("tbate");` (line ~54), add after its existing expectations:

```ts
    expect(t.layout).toBe("strip");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/source/mangadex.test.ts tests/unit/source/scrapergo.test.ts`
Expected: FAIL — language is always `ko`; `layout` undefined.

- [ ] **Step 3: Implement**

`mangadex/schemas.ts` — in `MangaSchema.attributes`, after `contentRating: z.string(),`:

```ts
    originalLanguage: z.string().nullish(),
```

`mangadex/normalize.ts`:
- Change the types import to `import type { Chapter, FeaturedItem, Layout, Title, TitleSummary } from "../types";`
- Add before `toTitle`:

```ts
/** Korean originals and anything MangaDex tags "Long Strip" read vertically; the rest page by page. */
export function layoutOf(m: MdManga): Layout {
  if (m.attributes.originalLanguage === "ko") return "strip";
  const longStrip = m.attributes.tags.some((t) => t.attributes.group === "format" && t.attributes.name.en === "Long Strip");
  return longStrip ? "strip" : "paged";
}
```

- In `toTitle`'s returned object, after `contentRating: a.contentRating,` add `layout: layoutOf(m),`

`mangadex/index.ts`:
- Change the filters import to `import { effectiveKind, effectiveRatings, type Kind, type SortKey, type Tag } from "../filters";`
- Add next to the other constants:

```ts
const LANGUAGE: Record<Kind, string> = { manga: "ja", manhwa: "ko" };
```

- In `listParams`, replace `p.append("originalLanguage[]", "ko");` with:

```ts
    p.append("originalLanguage[]", LANGUAGE[effectiveKind(opts)]);
```

- Replace the `featured` signature, doc and first line:

```ts
  /** Featured = most followed titles of the kind that got an update in the last FEATURED_DAYS days. */
  async featured(opts: { mature: boolean; kind?: Kind; now?: () => number }): Promise<FeaturedItem[]> {
    const p = this.listParams(1, { mature: opts.mature, kind: opts.kind, sort: "follows" }, effectiveRatings(opts.mature), false);
```

`scrapergo/normalize.ts` — in `toTitle`'s returned object, after `genres: asList(info.Genre),` add `layout: "strip",`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/source/mangadex.test.ts tests/unit/source/scrapergo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/source/mangadex src/lib/source/scrapergo tests/unit/source/mangadex.test.ts tests/unit/source/scrapergo.test.ts
git commit -m "feat: MangaDex lists by kind language; titles report their layout"
```

---

### Task 4: Service cache keys and featured route

**Files:**
- Modify: `src/lib/source/service.ts`, `src/app/api/featured/route.ts`
- Test: `tests/unit/source/service.test.ts`, `tests/unit/api/routes.test.ts`

**Interfaces:**
- Consumes: `Kind`, `DEFAULT_KIND`, `effectiveKind`, `sourceSupportsKind`, `parseFilters` (Task 1)
- Produces:
  - `SourceService.home/search` keys: `v1:${key}:home:${kind}:${page}:${m}${suffix}` / `v1:${key}:search:${kind}:${q}:${page}:${m}${suffix}`; unsupported kind → `{ value: { items: [], page, hasMore: false }, stale: false }` without calling the source.
  - `SourceService.featured(mature: boolean, source?: SourceKey, kind: Kind = DEFAULT_KIND)`, key `v1:${key}:featured:${kind}:${m}`; unsupported kind → `[]`.
  - `GET /api/featured?mature=&source=&kind=` — invalid `kind` → 400.

- [ ] **Step 1: Write the failing tests**

`tests/unit/source/service.test.ts` — existing tests assume the manhwa catalog:
- `"search key normalizes query"`: `s.search("  Bakery ", 1, false)` → `s.search("  Bakery ", 1, false, undefined, { kind: "manhwa" })`.
- `"list endpoints fall back..."`: add `undefined`-safe filters: `s.home(1, false, "md", { kind: "manhwa" })` and `s.search("bakery", 1, false, "sg", { kind: "manhwa" })`.
- `"filters are part of the cache key..."`: use `{ kind: "manhwa", tags: ["fantasy"] }` (both calls) and `{ kind: "manhwa", tags: ["romance"] }`; the `toHaveBeenLastCalledWith` becomes `(1, { mature: true, kind: "manhwa", tags: ["romance"] })`.
- `"tags: ..."`: expected length `4` → `5`.
- `"featured: ..."`: change the three mock calls to pass kind manhwa: `s.featured(false, undefined, "manhwa")` (twice) and `s.featured(true, undefined, "manhwa")`; keep `s.featured(false, "sg")`.

Append inside `describe("SourceService", ...)`:

```ts
  test("kind is always in the list cache key, default manga", async () => {
    const mock = new MockSource();
    const home = vi.spyOn(mock, "home");
    const s = new SourceService({ sources: { mock }, cache: createCache(new MemoryLRUStore()), defaultSource: "mock" });
    expect((await s.home(1, false)).value.items.map((i) => i.id)).toEqual(["mock:delta", "mock:epsilon"]);
    expect((await s.home(1, false, undefined, { kind: "manhwa" })).value.items.map((i) => i.id)).toEqual(["mock:alpha", "mock:beta"]);
    await s.home(1, false);
    expect(home).toHaveBeenCalledTimes(2);
  });
  test("manga on a manhwa-only source is empty without an upstream call", async () => {
    const sg = { home: vi.fn(), search: vi.fn(), title: vi.fn(), chapter: vi.fn(), featured: vi.fn() };
    const s = new SourceService({ sources: { sg }, cache: createCache(new MemoryLRUStore()), defaultSource: "sg" });
    expect((await s.home(2, false)).value).toEqual({ items: [], page: 2, hasMore: false });
    expect((await s.search("x", 1, false)).value).toEqual({ items: [], page: 1, hasMore: false });
    expect((await s.featured(false)).value).toEqual([]);
    expect(sg.home).not.toHaveBeenCalled();
    expect(sg.search).not.toHaveBeenCalled();
    expect(sg.featured).not.toHaveBeenCalled();
  });
  test("featured is cached per kind", async () => {
    const mock = new MockSource();
    const featured = vi.spyOn(mock, "featured");
    const s = new SourceService({ sources: { mock }, cache: createCache(new MemoryLRUStore()), defaultSource: "mock" });
    expect((await s.featured(false)).value.map((i) => i.id)).toEqual(["mock:delta", "mock:epsilon"]);
    expect((await s.featured(false, undefined, "manhwa")).value.map((i) => i.id)).toEqual(["mock:alpha", "mock:beta"]);
    expect(featured).toHaveBeenCalledTimes(2);
    expect(featured).toHaveBeenLastCalledWith({ mature: false, kind: "manhwa" });
  });
```

`tests/unit/api/routes.test.ts`:
- `"home applies filters from query params"` (line ~70): the URL becomes `"/api/home?page=1&mature=1&tags=fantasy&sort=title&kind=manhwa"` (without it the default manga catalog returns `mock:delta`, which is also Fantasy).
- Featured route test: `req("/api/featured?mature=0")` → `req("/api/featured?mature=0&kind=manhwa")`, and add after the `source=zz` assertion:

```ts
    expect((await GET(req("/api/featured?kind=manhua"))).status).toBe(400);
    expect((await (await GET(req("/api/featured?mature=0"))).json()).data.map((i: { id: string }) => i.id)).toEqual(["mock:delta", "mock:epsilon"]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/source/service.test.ts tests/unit/api/routes.test.ts`
Expected: FAIL — default kind returns manga but keys/featured don't separate kinds; `kind=manhua` returns 200.

- [ ] **Step 3: Implement**

`src/lib/source/service.ts`:
- Change the filters import to `import { DEFAULT_KIND, effectiveKind, filtersKey, sourceSupportsKind, type Filters, type Kind, type Tag } from "./filters";`
- Replace `home`, `search`, `featured`:

```ts
  async home(page: number, mature: boolean, source?: SourceKey, filters: Filters = {}): Promise<CachedResult<Page<TitleSummary>>> {
    const { key, src } = this.list(source);
    const kind = effectiveKind(filters);
    if (!sourceSupportsKind(key, kind)) return { value: { items: [], page, hasMore: false }, stale: false };
    return this.deps.cache.cached(`v1:${key}:home:${kind}:${page}:${mature ? 1 : 0}${suffix(filters)}`, POLICIES.home, () =>
      src.home(page, { mature, ...filters }),
    );
  }

  async search(q: string, page: number, mature: boolean, source?: SourceKey, filters: Filters = {}): Promise<CachedResult<Page<TitleSummary>>> {
    const { key, src } = this.list(source);
    const kind = effectiveKind(filters);
    if (!sourceSupportsKind(key, kind)) return { value: { items: [], page, hasMore: false }, stale: false };
    const norm = q.trim().replace(/\s+/g, " ");
    return this.deps.cache.cached(
      `v1:${key}:search:${kind}:${encodeURIComponent(norm.toLowerCase())}:${page}:${mature ? 1 : 0}${suffix(filters)}`,
      POLICIES.search,
      () => src.search(norm, page, { mature, ...filters }),
    );
  }

  /** Banner titles for a list source and kind; [] when the source has no featured support or lacks the kind. */
  async featured(mature: boolean, source?: SourceKey, kind: Kind = DEFAULT_KIND): Promise<CachedResult<FeaturedItem[]>> {
    const { key, src } = this.list(source);
    if (!src.featured || !sourceSupportsKind(key, kind)) return { value: [], stale: false };
    const featured = src.featured.bind(src);
    return this.deps.cache.cached(`v1:${key}:featured:${kind}:${mature ? 1 : 0}`, POLICIES.featured, () => featured({ mature, kind }));
  }
```

`src/app/api/featured/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { POLICIES } from "@/lib/cache/policies";
import { badRequest, errorResponse, jsonResult } from "@/lib/api/respond";
import { effectiveKind, parseFilters } from "@/lib/source/filters";
import { isSourceKey } from "@/lib/source/ids";
import { getSourceService } from "@/lib/source/service-instance";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const source = sp.get("source");
  if (source !== null && !isSourceKey(source)) return badRequest("Invalid source");
  const filters = parseFilters(sp);
  if (filters === null) return badRequest("Invalid filters");
  try {
    return jsonResult(await getSourceService().featured(sp.get("mature") === "1", source ?? undefined, effectiveKind(filters)), POLICIES.featured);
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 4: Run the whole unit suite**

Run: `npx vitest run`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add src/lib/source/service.ts src/app/api/featured/route.ts tests/unit/source/service.test.ts tests/unit/api/routes.test.ts
git commit -m "feat: kind in list and featured cache keys; manhwa-only sources return empty for manga"
```

---

### Task 5: Catalog toggle UI and copy

**Files:**
- Create: `src/components/KindToggle.tsx`
- Modify: `src/lib/query/hooks.ts`, `src/components/FeaturedBanner.tsx`, `src/components/Filters.tsx`, `src/app/page.tsx`, `src/components/HeaderSearch.tsx`, `src/app/layout.tsx`, `src/app/manifest.ts`
- Test: `tests/e2e/reader.spec.ts`, `tests/e2e/settings.spec.ts`, Create `tests/e2e/manga.spec.ts`

**Interfaces:**
- Consumes: `KINDS`, `Kind`, `DEFAULT_KIND`, `effectiveKind`, `clearFilters`, `sourceSupportsKind` (Task 1); `/api/featured?kind=` (Task 4)
- Produces: `KindToggle({ kind, onChange })` — `role="radiogroup"` `aria-label="Catalog"`, radios named "Manga" / "Manhwa"; `useFeatured(mature, source, kind, enabled)`; `FeaturedBanner` prop `kind`.

- [ ] **Step 1: Update existing e2e for the new default and write the new e2e**

`tests/e2e/reader.spec.ts` — the manhwa fixtures are now behind `?kind=manhwa`:
- Every `page.goto("/")` in the tests `"browse, open title, read, resume, complete"` (both occurrences), `"filters: genre and sort..."`, `"featured banner: slides..."`, `"featured banner autoplays..."` → `page.goto("/?kind=manhwa")`.
- In `"featured banner: slides..."`: `page.goto("/?q=bak")` → `page.goto("/?q=bak&kind=manhwa")`.
- Every `getByLabel("Search manhwa")` → `getByLabel("Search titles")`.
- Replace the body of `"search from the header turns home into results"` (it starts on `/library`, so it searches the default manga catalog):

```ts
test("search from the header turns home into results", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("Search titles").fill("lan");
  await expect(page).toHaveURL(/\/\?q=lan$/);
  await expect(page.getByTestId("title-card")).toHaveCount(1);
  await expect(page.getByText("Paper Lantern")).toBeVisible();
  await page.getByLabel("Search titles").fill("zzzz");
  await expect(page.getByText(/No results/)).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("title-card")).toHaveCount(2);
});
```

`tests/e2e/settings.spec.ts` line 11: `page.goto("/")` → `page.goto("/?kind=manhwa")`.

Create `tests/e2e/manga.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const catalog = (page: import("@playwright/test").Page) => page.getByRole("radiogroup", { name: "Catalog" });

test("home opens on manga; the toggle switches catalogs and back", async ({ page }) => {
  await page.goto("/");
  await expect(catalog(page).getByRole("radio", { name: "Manga" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("title-card")).toHaveCount(2);
  await expect(page.getByTestId("title-card").filter({ hasText: "Paper Lantern" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Featured" }).getByRole("list", { name: "Featured titles" }).getByRole("listitem")).toHaveCount(2);

  await catalog(page).getByRole("radio", { name: "Manhwa" }).click();
  await expect(page).toHaveURL(/\/\?kind=manhwa$/);
  await expect(page.getByTestId("title-card").filter({ hasText: "Skyward Blade" })).toBeVisible();
  await expect(page.getByTestId("title-card")).toHaveCount(2);

  await catalog(page).getByRole("radio", { name: "Manga" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("title-card").filter({ hasText: "Iron Courier" })).toBeVisible();
});

test("header search on manhwa stays on manhwa; clear all keeps the catalog", async ({ page }) => {
  await page.goto("/?kind=manhwa");
  await page.getByLabel("Search titles").fill("bak");
  await expect(page).toHaveURL(/\/\?q=bak&kind=manhwa$/);
  await expect(page.getByTestId("title-card")).toHaveCount(1);
  await expect(page.getByText("Moonlit Bakery")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();

  await page.getByRole("button", { name: /^Sort:/ }).click();
  await page.getByRole("option", { name: "A–Z" }).click();
  await expect(page).toHaveURL(/kind=manhwa&sort=title/);
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page).toHaveURL(/\/\?kind=manhwa$/);
  await expect(catalog(page).getByRole("radio", { name: "Manhwa" })).toHaveAttribute("aria-checked", "true");
});
```

- [ ] **Step 2: Run e2e to verify they fail**

Run: `npx playwright test tests/e2e/manga.spec.ts tests/e2e/reader.spec.ts`
Expected: FAIL — no "Catalog" radiogroup; label "Search titles" not found.

- [ ] **Step 3: Implement**

Create `src/components/KindToggle.tsx`:

```tsx
"use client";
import { KINDS, type Kind } from "@/lib/source/filters";

const LABEL: Record<Kind, string> = { manga: "Manga", manhwa: "Manhwa" };

/** Segmented switch between the manga and manhwa catalogs. */
export function KindToggle({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) {
  return (
    <div role="radiogroup" aria-label="Catalog" className="mb-5 inline-flex rounded-full border border-line bg-card p-1">
      {KINDS.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={kind === k}
          onClick={() => kind !== k && onChange(k)}
          className={`press min-h-9 rounded-full px-4 text-[13px] font-bold ${kind === k ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}
        >
          {LABEL[k]}
        </button>
      ))}
    </div>
  );
}
```

`src/lib/query/hooks.ts` — change the filters import to `import { filtersKey, type Kind, type Tag } from "../source/filters";` and replace `useFeatured`:

```ts
export const useFeatured = (mature: boolean, source: SourceKey, kind: Kind, enabled = true) =>
  useQuery({
    queryKey: ["featured", source, mature, kind],
    queryFn: () => api<FeaturedItem[]>(`/api/featured?mature=${mature ? 1 : 0}&source=${source}&kind=${kind}`),
    staleTime: 60 * MIN,
    enabled,
  });
```

`src/components/FeaturedBanner.tsx` — add `import type { Kind } from "@/lib/source/filters";` and change the component signature and query line:

```tsx
export function FeaturedBanner({ mature, source, kind, enabled }: { mature: boolean; source: SourceKey; kind: Kind; enabled: boolean }) {
  const q = useFeatured(mature, source, kind, enabled);
```

`src/components/Filters.tsx`:
- Add `clearFilters` to the import from `@/lib/source/filters`.
- "Clear all" button: `onClick={() => onChange({})}` → `onClick={() => onChange(clearFilters(filters))}`.
- FilterSheet "Reset" button: `onClick={() => setDraft({})}` → `onClick={() => setDraft(clearFilters(initial))}`.

`src/app/page.tsx`:
- Imports: `import { clearFilters, DEFAULT_KIND, effectiveKind, hasFilters, sourceSupportsKind, type Filters, type Kind } from "@/lib/source/filters";` and `import { KindToggle } from "@/components/KindToggle";`
- After `const setFilters = ...` add:

```tsx
  const kind = effectiveKind(state.filters);
  const setKind = (k: Kind) => setFilters({ ...state.filters, kind: k === DEFAULT_KIND ? undefined : k });
  const kindAvailable = sourceSupportsKind(settings.source, kind);
```

- Return: insert the toggle as the first element after `<h1 className="sr-only">Home</h1>`, and pass `kind` to the banner:

```tsx
      <KindToggle kind={kind} onChange={setKind} />
      {!browsing && <FeaturedBanner mature={settings.mature} source={settings.source} kind={kind} enabled={ready} />}
```

- Grid states: insert a branch right after the `<GridSkeleton />` branch, before the error branch:

```tsx
        ) : !kindAvailable ? (
          <EmptyState
            role="status"
            icon="filter"
            title="Manga isn't available on Toonily."
            body="Switch source in Settings, or browse manhwa."
            action={<Link href="/settings" className={buttonSecondary}>Open Settings</Link>}
          />
```

- "Clear filters" EmptyState action: `onClick={() => setFilters({})}` → `onClick={() => setFilters(clearFilters(state.filters))}`.

`src/components/HeaderSearch.tsx`: `placeholder="Search manhwa"` → `placeholder="Search titles"`, `aria-label="Search manhwa"` → `aria-label="Search titles"`.

`src/app/layout.tsx` and `src/app/manifest.ts`: `"A fast, mobile-first manhwa reader."` → `"A fast, mobile-first manhwa & manga reader."`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/e2e`
Expected: PASS (all e2e). Then `npx vitest run` — PASS. Then `npx tsc --noEmit && npm run lint` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/KindToggle.tsx src/lib/query/hooks.ts src/components/FeaturedBanner.tsx src/components/Filters.tsx src/app/page.tsx src/components/HeaderSearch.tsx src/app/layout.tsx src/app/manifest.ts tests/e2e
git commit -m "feat(ui): Manga | Manhwa catalog toggle, manga by default"
```

---

### Task 6: Reader mode logic and per-title prefs

**Files:**
- Create: `src/lib/reader/mode.ts`
- Modify: `src/lib/db/types.ts`, `src/lib/db/schema.ts`, `src/lib/db/actions.ts`, `src/lib/db/hooks.ts`, `src/lib/db/backup.ts`
- Test: Create `tests/unit/reader/mode.test.ts`; modify `tests/unit/db/backup.test.ts`, `tests/unit/db/actions.test.ts`

**Interfaces:**
- Consumes: `Layout` (Task 2)
- Produces:
  - `mode.ts`: `READER_MODES`, `type ReaderMode = "strip" | "paged-rtl" | "paged-ltr"`, `type PagedMode = Exclude<ReaderMode, "strip">`, `type PageStep = "next" | "prev"`, `resolveMode(pref?: ReaderMode, layout?: Layout): ReaderMode`, `tapAction(x: number, width: number, mode: PagedMode): PageStep | "toggle"`, `keyAction(key: string, mode: PagedMode): PageStep | null`, `swipeAction(dx: number, dy: number, mode: PagedMode): PageStep | null`, `SWIPE_MIN = 50`
  - DB: `TitlePref { titleId: string; mode: ReaderMode }`, table `titlePrefs` (schema version 2), `setReaderMode(d, titleId, mode)`, `useTitlePref(titleId)` → `TitlePref | null | undefined` (undefined while loading)
  - Backup: optional `titlePrefs` array exported and imported.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/reader/mode.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { keyAction, resolveMode, swipeAction, tapAction } from "@/lib/reader/mode";

describe("resolveMode", () => {
  test("pref wins; otherwise paged layout -> rtl, anything else -> strip", () => {
    expect(resolveMode("paged-ltr", "strip")).toBe("paged-ltr");
    expect(resolveMode(undefined, "paged")).toBe("paged-rtl");
    expect(resolveMode(undefined, "strip")).toBe("strip");
    expect(resolveMode(undefined, undefined)).toBe("strip"); // title cached before manga support
  });
});

describe("tapAction", () => {
  test("centre third toggles chrome", () => {
    expect(tapAction(500, 900, "paged-rtl")).toBe("toggle");
  });
  test("rtl: left is next, right is prev", () => {
    expect(tapAction(100, 900, "paged-rtl")).toBe("next");
    expect(tapAction(800, 900, "paged-rtl")).toBe("prev");
  });
  test("ltr: right is next, left is prev", () => {
    expect(tapAction(800, 900, "paged-ltr")).toBe("next");
    expect(tapAction(100, 900, "paged-ltr")).toBe("prev");
  });
});

describe("keyAction", () => {
  test("arrows follow reading direction; other keys ignored", () => {
    expect(keyAction("ArrowLeft", "paged-rtl")).toBe("next");
    expect(keyAction("ArrowRight", "paged-rtl")).toBe("prev");
    expect(keyAction("ArrowRight", "paged-ltr")).toBe("next");
    expect(keyAction("ArrowLeft", "paged-ltr")).toBe("prev");
    expect(keyAction("]", "paged-rtl")).toBeNull();
  });
});

describe("swipeAction", () => {
  test("ignores short or mostly vertical swipes", () => {
    expect(swipeAction(-40, 0, "paged-ltr")).toBeNull();
    expect(swipeAction(-80, 120, "paged-ltr")).toBeNull();
  });
  test("ltr: swipe left -> next; rtl: swipe right -> next", () => {
    expect(swipeAction(-80, 10, "paged-ltr")).toBe("next");
    expect(swipeAction(80, 10, "paged-ltr")).toBe("prev");
    expect(swipeAction(80, 10, "paged-rtl")).toBe("next");
    expect(swipeAction(-80, 10, "paged-rtl")).toBe("prev");
  });
});
```

Append to `tests/unit/db/actions.test.ts` (it creates a fresh `d` per test with `fake-indexeddb/auto`; add `setReaderMode` to its `@/lib/db/actions` import):

```ts
describe("setReaderMode", () => {
  test("stores and replaces the per-title mode", async () => {
    await setReaderMode(d, "md:a", "paged-ltr");
    await setReaderMode(d, "md:a", "strip");
    expect(await d.titlePrefs.get("md:a")).toEqual({ titleId: "md:a", mode: "strip" });
  });
});
```


In `tests/unit/db/backup.test.ts` — add `setReaderMode` to the actions import, and append inside `describe("backup", ...)`:

```ts
  test("title prefs round trip; backups without them still import", async () => {
    await setReaderMode(d, "md:a", "paged-ltr");
    const dump = await exportData(d);
    expect(dump.titlePrefs).toEqual([{ titleId: "md:a", mode: "paged-ltr" }]);
    const d2 = createDb(`b3-${Math.random()}`);
    await d2.open();
    await importData(d2, JSON.parse(JSON.stringify(dump)));
    expect(await d2.titlePrefs.get("md:a")).toEqual({ titleId: "md:a", mode: "paged-ltr" });
    const { titlePrefs: _omit, ...old } = dump;
    await expect(importData(d2, old)).resolves.toBeTruthy();
  });
```

And add a row to the `test.each` rejection table:

```ts
    ["bad reader mode", { version: 1, exportedAt: 1, library: [], history: [], progress: [], settings: [], titlePrefs: [{ titleId: "t", mode: "sideways" }] }],
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/reader/mode.test.ts tests/unit/db`
Expected: FAIL — module `@/lib/reader/mode` not found; `setReaderMode` not exported.

- [ ] **Step 3: Implement**

Create `src/lib/reader/mode.ts`:

```ts
import type { Layout } from "../source/types";

export const READER_MODES = ["strip", "paged-rtl", "paged-ltr"] as const;
export type ReaderMode = (typeof READER_MODES)[number];
export type PagedMode = Exclude<ReaderMode, "strip">;
export type PageStep = "next" | "prev";

export const SWIPE_MIN = 50;

/** A saved per-title choice wins; otherwise paged titles read right-to-left and everything else as a strip. */
export function resolveMode(pref: ReaderMode | undefined, layout: Layout | undefined): ReaderMode {
  if (pref) return pref;
  return layout === "paged" ? "paged-rtl" : "strip";
}

/** Outer thirds turn the page, the centre third toggles the reader chrome. */
export function tapAction(x: number, width: number, mode: PagedMode): PageStep | "toggle" {
  const third = width / 3;
  if (x > third && x < 2 * third) return "toggle";
  const left = x <= third;
  return left === (mode === "paged-rtl") ? "next" : "prev";
}

export function keyAction(key: string, mode: PagedMode): PageStep | null {
  if (key === "ArrowLeft") return mode === "paged-rtl" ? "next" : "prev";
  if (key === "ArrowRight") return mode === "paged-rtl" ? "prev" : "next";
  return null;
}

/** dx/dy are pointer-up minus pointer-down. A swipe pulls the next page in from the reading direction's far side. */
export function swipeAction(dx: number, dy: number, mode: PagedMode): PageStep | null {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return null;
  const swipedLeft = dx < 0;
  return swipedLeft === (mode === "paged-ltr") ? "next" : "prev";
}
```

`src/lib/db/types.ts` — add:

```ts
import type { ReaderMode } from "../reader/mode";

export interface TitlePref {
  titleId: string;
  mode: ReaderMode;
}
```

(keep the existing `SourceKey` import; put both imports at the top.)

`src/lib/db/schema.ts`:
- Import `TitlePref` alongside the other types.
- Add the table property `titlePrefs!: Table<TitlePref, string>;`
- After the `this.version(1).stores({...})` call add:

```ts
    this.version(2).stores({ titlePrefs: "titleId" });
```

`src/lib/db/actions.ts` — add `import type { ReaderMode } from "../reader/mode";` and:

```ts
export async function setReaderMode(d: ToonifyDB, titleId: string, mode: ReaderMode) {
  await d.titlePrefs.put({ titleId, mode });
}
```

`src/lib/db/hooks.ts` — add:

```ts
export const useTitlePref = (titleId: string) =>
  useLiveQuery(async () => (await db.titlePrefs.get(titleId)) ?? null, [titleId]);
```

`src/lib/db/backup.ts`:
- Add `import { READER_MODES } from "../reader/mode";`
- Add a schema next to the others:

```ts
const TitlePref = z.object({ titleId: z.string(), mode: z.enum(READER_MODES) });
```

- In `BackupSchema`, after `settings`:

```ts
  /** Added with manga support; absent in older backups. */
  titlePrefs: z.array(TitlePref).max(10_000).optional(),
```

- `exportData`: add `d.titlePrefs.toArray()` to the `Promise.all` (destructure as `titlePrefs`) and `titlePrefs,` to the returned object.
- `importData`: add `d.titlePrefs` to the transaction table list, and after the settings loop:

```ts
    for (const p of b.titlePrefs ?? []) await d.titlePrefs.put(p);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reader/mode.test.ts tests/unit/db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reader/mode.ts src/lib/db tests/unit/reader/mode.test.ts tests/unit/db
git commit -m "feat: reader mode resolution, page-turn gestures and per-title mode prefs"
```

---

### Task 7: Paged progress tracking

**Files:**
- Modify: `src/lib/reader/progress.ts`
- Create: `src/components/reader/usePagedTracking.ts`
- Test: `tests/unit/reader/progress.test.ts`

**Interfaces:**
- Consumes: `createTracker`, `Measure` (existing)
- Produces:
  - `pagedMeasure(index: number, pageCount: number): Measure` — `index` may equal `pageCount` (the end card)
  - Callers pass `pageCount: 0` to `usePagedTracking` until the saved page has been restored (Task 9 does this); the tracker is then created at the restored index without firing scroll-down or saving page 0.
  - `clampRestore(saved: number | undefined, pageCount: number): number`
  - `usePagedTracking({ titleId, chapterId, pageCount, index, onPrefetch, onComplete, onScrollDown, onProgress })` — same callback contract as `useReaderTracking`; no-ops when `pageCount === 0`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/reader/progress.test.ts` (add `clampRestore, pagedMeasure` to the import from `@/lib/reader/progress`):

```ts
describe("paged progress", () => {
  test("pagedMeasure: ratio counts the current page as read; end card = 1", () => {
    expect(pagedMeasure(0, 5)).toMatchObject({ pageIndex: 0, ratio: 0.2 });
    expect(pagedMeasure(4, 5)).toMatchObject({ pageIndex: 4, ratio: 1 });
    expect(pagedMeasure(5, 5)).toMatchObject({ pageIndex: 4, ratio: 1 });
    expect(pagedMeasure(0, 0)).toMatchObject({ pageIndex: 0, ratio: 0 });
  });
  test("drives the tracker: forward hides chrome, prefetch at 0.7, complete on the last page", () => {
    let i = 0;
    const onPrefetch = vi.fn();
    const onComplete = vi.fn(() => true);
    const onScrollDown = vi.fn();
    const t = createTracker({ pageCount: 5, measure: () => pagedMeasure(i, 5), persist: vi.fn(), onPrefetch, onComplete, onScrollDown });
    i = 1; t.update();
    expect(onScrollDown).toHaveBeenCalledTimes(1);
    i = 2; t.update();
    expect(onPrefetch).not.toHaveBeenCalled();
    i = 3; t.update();
    expect(onPrefetch).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    i = 4; t.update();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  test("clampRestore keeps a saved page inside the chapter", () => {
    expect(clampRestore(undefined, 5)).toBe(0);
    expect(clampRestore(2, 5)).toBe(2);
    expect(clampRestore(12, 5)).toBe(4);
    expect(clampRestore(-1, 5)).toBe(0);
    expect(clampRestore(3, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/reader/progress.test.ts`
Expected: FAIL — `pagedMeasure is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/reader/progress.ts`:

```ts
/** Tracker `y` step per page, comfortably above createTracker's 10px "scrolled down" threshold. */
const PAGE_STEP_Y = 1000;

/** Measurement for the paged reader. `index === pageCount` is the end card. */
export function pagedMeasure(index: number, pageCount: number): Measure {
  if (pageCount <= 0) return { y: 0, pageIndex: 0, ratio: 0 };
  return { y: index * PAGE_STEP_Y, pageIndex: Math.min(index, pageCount - 1), ratio: Math.min(1, (index + 1) / pageCount) };
}

/** A saved page index clipped to the chapter (it may come from an older, longer upload). */
export function clampRestore(saved: number | undefined, pageCount: number): number {
  if (!saved || pageCount <= 0) return 0;
  return Math.min(Math.max(0, saved), pageCount - 1);
}
```

Create `src/components/reader/usePagedTracking.ts`:

```ts
"use client";
import { useEffect, useRef } from "react";
import { db } from "@/lib/db/schema";
import { saveProgress } from "@/lib/db/actions";
import { createTracker, pagedMeasure } from "@/lib/reader/progress";

interface Args {
  titleId: string;
  chapterId: string;
  pageCount: number;
  /** Current page; equals pageCount while the end card is shown. */
  index: number;
  onPrefetch: () => void;
  onComplete: () => boolean;
  onScrollDown: () => void;
  onProgress?: (ratio: number) => void;
}

/** Paged-reader twin of useReaderTracking: same tracker, fed page turns instead of scroll positions. */
export function usePagedTracking({ titleId, chapterId, pageCount, index, onPrefetch, onComplete, onScrollDown, onProgress }: Args) {
  const cb = useRef({ onPrefetch, onComplete, onScrollDown, onProgress });
  cb.current = { onPrefetch, onComplete, onScrollDown, onProgress };
  const indexRef = useRef(index);
  indexRef.current = index;
  const trackerRef = useRef<ReturnType<typeof createTracker> | null>(null);

  useEffect(() => {
    if (pageCount === 0) return;
    const tracker = createTracker({
      pageCount,
      initialY: pagedMeasure(indexRef.current, pageCount).y,
      measure: () => pagedMeasure(indexRef.current, pageCount),
      persist: (s) => void saveProgress(db, { titleId, chapterId, pageIndex: s.pageIndex, scrollRatio: s.ratio }),
      onPrefetch: () => cb.current.onPrefetch(),
      onComplete: () => cb.current.onComplete(),
      onScrollDown: () => cb.current.onScrollDown(),
    });
    trackerRef.current = tracker;
    cb.current.onProgress?.(pagedMeasure(indexRef.current, pageCount).ratio);
    const save = () => tracker.save();
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    const timer = setInterval(save, 2000);
    return () => {
      trackerRef.current = null;
      tracker.dispose();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [titleId, chapterId, pageCount]);

  useEffect(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    tracker.update();
    cb.current.onProgress?.(tracker.snapshot.ratio);
  }, [index]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reader/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reader/progress.ts src/components/reader/usePagedTracking.ts tests/unit/reader/progress.test.ts
git commit -m "feat: paged reader progress measurement and tracking hook"
```

---

### Task 8: Split the reader into shell, StripView and EndCard (no behaviour change)

**Files:**
- Create: `src/components/reader/StripView.tsx`, `src/components/reader/EndCard.tsx`
- Modify: `src/components/reader/Reader.tsx`
- Test: existing `tests/e2e/reader.spec.ts` (regression)

**Interfaces:**
- Produces:
  - `EndCard({ titleId, current, next }: { titleId: string; current?: Chapter; next?: Chapter })` — the existing "End of chapter" `<section>`, verbatim.
  - `type ReaderCallbacks = { onPrefetch: () => void; onComplete: () => boolean; onScrollDown: () => void; onProgress: (r: number) => void }` exported from `StripView.tsx`.
  - `StripView({ titleId, chapterId, pages, pending, readerWidth, onToggleOverlay, callbacks, endCard }: { titleId: string; chapterId: string; pages: string[]; pending: boolean; readerWidth: number; onToggleOverlay: () => void; callbacks: ReaderCallbacks; endCard: ReactNode })` — owns `useReaderTracking` and the centre-third tap.

- [ ] **Step 1: Confirm the regression suite is green before refactoring**

Run: `npx playwright test tests/e2e/reader.spec.ts`
Expected: PASS.

- [ ] **Step 2: Create `EndCard.tsx`**

```tsx
import Link from "next/link";
import type { Chapter } from "@/lib/source/types";
import { Icon } from "@/components/icons";
import { readHref, titleHref } from "@/components/TitleCard";

export function EndCard({ titleId, current, next }: { titleId: string; current?: Chapter; next?: Chapter }) {
  return (
    <section aria-label="End of chapter" className="mx-auto max-w-md px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-14 text-center text-white">
      <p className="display text-[2.5rem] text-white">End of {current?.name ?? "chapter"}</p>
      {current?.group && (
        <p className="mt-2 text-sm text-neutral-400">
          Scanlated by <span className="font-semibold text-neutral-200">{current.group}</span>
          {titleId.startsWith("md:") ? " · via MangaDex" : ""}
        </p>
      )}
      {next ? (
        <Link
          href={readHref(titleId, next.id)}
          className="press mt-7 flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-base font-bold text-[var(--accent-fg)] shadow-[0_10px_40px_-10px_var(--accent)]"
        >
          Next: {next.name}
          <Icon name="forward" className="h-5 w-5" strokeWidth={2.4} />
        </Link>
      ) : (
        <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-5 py-6">
          <p className="text-lg font-bold text-white">You&apos;re caught up.</p>
          <p className="mt-1 text-sm text-neutral-400">New chapters will show up on the title page and in your library.</p>
        </div>
      )}
      <Link
        href={titleHref(titleId)}
        className={`press mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 text-sm font-semibold hover:text-white ${next ? "text-neutral-300" : "mt-5 border border-white/20 text-white"}`}
      >
        <Icon name="back" className="h-4 w-4" />
        Back to title
      </Link>
    </section>
  );
}
```

- [ ] **Step 3: Create `StripView.tsx`**

```tsx
"use client";
import type { ReactNode } from "react";
import { ReaderPage } from "./ReaderPage";
import { useReaderTracking } from "./useReaderTracking";

export interface ReaderCallbacks {
  onPrefetch: () => void;
  onComplete: () => boolean;
  onScrollDown: () => void;
  onProgress: (ratio: number) => void;
}

/** The vertical long-strip reader. */
export function StripView({
  titleId,
  chapterId,
  pages,
  pending,
  readerWidth,
  onToggleOverlay,
  callbacks,
  endCard,
}: {
  titleId: string;
  chapterId: string;
  pages: string[];
  pending: boolean;
  readerWidth: number;
  onToggleOverlay: () => void;
  callbacks: ReaderCallbacks;
  endCard: ReactNode;
}) {
  useReaderTracking({ titleId, chapterId, pageCount: pages.length, ...callbacks });

  const onTap = (e: React.MouseEvent) => {
    const w = window.innerWidth;
    if (e.clientX > w / 3 && e.clientX < (2 * w) / 3) onToggleOverlay();
  };

  return (
    <>
      <div onClick={onTap} className="mx-auto" style={{ maxWidth: `min(100%, ${readerWidth}px)` }}>
        {pending
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} role={i === 0 ? "status" : undefined} aria-label={i === 0 ? "Loading chapter" : undefined} className="flex aspect-[2/3] w-full items-center justify-center bg-neutral-950">
                {i === 0 && <span aria-hidden className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />}
              </div>
            ))
          : pages.map((src, i) => <ReaderPage key={src} src={src} index={i} eager={i < 3} />)}
      </div>
      {!pending && endCard}
    </>
  );
}
```

- [ ] **Step 4: Rewire `Reader.tsx`**

- Remove imports no longer used here (`Link`, `Icon`, `ReaderPage`, `useReaderTracking`, `titleHref` — keep `readHref`). Add `import { EndCard } from "./EndCard";` and `import { StripView } from "./StripView";`.
- Delete the `useReaderTracking(...)` call and the `onTap` function.
- Add after `onScrollDown`:

```tsx
  const callbacks = { onPrefetch, onComplete, onScrollDown, onProgress: setProgress };
  const toggleOverlay = useCallback(() => setOverlay((v) => !v), []);
  const endCard = <EndCard titleId={titleId} current={current} next={next} />;
```

- Replace everything in the returned `<div className="min-h-dvh bg-black">` after the `<h1 className="sr-only">…</h1>` with:

```tsx
      <StripView
        titleId={titleId}
        chapterId={chapterId}
        pages={pages}
        pending={chapterQ.isPending}
        readerWidth={settings.readerWidth}
        onToggleOverlay={toggleOverlay}
        callbacks={callbacks}
        endCard={endCard}
      />
```

- [ ] **Step 5: Verify no behaviour change**

Run: `npx tsc --noEmit && npm run lint && npx playwright test tests/e2e/reader.spec.ts`
Expected: clean, PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/reader
git commit -m "refactor(reader): split shell, StripView and EndCard"
```

---

### Task 9: PagedView, mode switch, wiring

**Files:**
- Create: `src/components/reader/PagedView.tsx`
- Modify: `src/components/reader/ReaderPage.tsx`, `src/components/reader/ReaderOverlay.tsx`, `src/components/reader/Reader.tsx`
- Test: `tests/e2e/manga.spec.ts`

**Interfaces:**
- Consumes: `resolveMode`, `tapAction`, `keyAction`, `swipeAction`, `ReaderMode`, `PagedMode`, `PageStep`, `READER_MODES` (Task 6); `useTitlePref`, `setReaderMode` (Task 6); `usePagedTracking` (Task 7); `clampRestore` (Task 7); `ReaderCallbacks`, `EndCard`, `StripView` (Task 8); `Title.layout` (Task 2)
- Produces: `PagedView({ titleId, chapterId, pages, pending, mode, onToggleOverlay, callbacks, endCard })`; `ReaderPage` prop `fit?: boolean`; `ReaderOverlay` props `mode: ReaderMode`, `onModeChange: (m: ReaderMode) => void`.

- [ ] **Step 1: Write the failing e2e**

Append to `tests/e2e/manga.spec.ts`:

```ts
const shown = (page: import("@playwright/test").Page) => page.locator("[data-page-index]");

test("paged right-to-left: taps, arrows, end card", async ({ page }) => {
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveCount(1);
  await expect(shown(page)).toHaveAttribute("data-page-index", "0");

  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width * 0.15, vp.height / 2); // left third = next in RTL
  await expect(shown(page)).toHaveAttribute("data-page-index", "1");
  await page.mouse.click(vp.width * 0.85, vp.height / 2); // right third = prev
  await expect(shown(page)).toHaveAttribute("data-page-index", "0");

  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("region", { name: "End of chapter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Next: Ch. 2" })).toBeVisible();
  await page.getByRole("button", { name: "Back to page 5" }).click();
  await expect(shown(page)).toHaveAttribute("data-page-index", "4");
});

test("a swipe turns exactly one page", async ({ page }) => {
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveAttribute("data-page-index", "0");
  const vp = page.viewportSize()!;
  // Swipe right (RTL next) starting in the left third: must not also count as a left-third tap.
  await page.mouse.move(vp.width * 0.2, vp.height / 2);
  await page.mouse.down();
  await page.mouse.move(vp.width * 0.8, vp.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(shown(page)).toHaveAttribute("data-page-index", "1");
});

test("paged position resumes", async ({ page }) => {
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveAttribute("data-page-index", "0");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(shown(page)).toHaveAttribute("data-page-index", "2");
  await page.waitForTimeout(2500); // periodic save
  await page.goto("/");
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveAttribute("data-page-index", "2");
});

test("mode override persists per title", async ({ page }) => {
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveCount(1);
  await page.getByRole("button", { name: /^Reading mode:/ }).click();
  await page.getByRole("option", { name: "Long strip" }).click();
  await expect(shown(page)).toHaveCount(5);
  await page.reload();
  await expect(shown(page)).toHaveCount(5);

  await page.goto("/read/mock%3Aalpha/1"); // manhwa stays a strip
  await expect(shown(page)).toHaveCount(5);
});
```

- [ ] **Step 2: Run e2e to verify they fail**

Run: `npx playwright test tests/e2e/manga.spec.ts`
Expected: the four new tests FAIL (delta renders 5 strip pages; no "Reading mode" control).

- [ ] **Step 3: Add `fit` to `ReaderPage`**

Change the signature and the wrapper/image classes in `src/components/reader/ReaderPage.tsx`:

```tsx
export function ReaderPage({ src, index, eager, fit = false }: { src: string; index: number; eager: boolean; fit?: boolean }) {
```

Wrapper `className`:

```tsx
    <div
      data-page-index={index}
      className={fit ? "relative flex h-dvh w-full items-center justify-center" : state === "ok" ? "" : "relative aspect-[2/3] w-full bg-neutral-950"}
    >
```

Image `className`:

```tsx
          className={
            state === "ok"
              ? fit
                ? "block max-h-dvh max-w-full select-none object-contain"
                : "block w-full select-none"
              : "absolute inset-0 h-full w-full opacity-0"
          }
```

The Retry button already calls `e.stopPropagation()`, so it won't turn the page.

- [ ] **Step 4: Create `PagedView.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { db } from "@/lib/db/schema";
import { keyAction, swipeAction, tapAction, type PagedMode, type PageStep } from "@/lib/reader/mode";
import { clampRestore } from "@/lib/reader/progress";
import { ReaderPage } from "./ReaderPage";
import type { ReaderCallbacks } from "./StripView";
import { usePagedTracking } from "./usePagedTracking";

const PRELOAD = [1, 2, -1, -2];

/** One page at a time, fitted to the screen; the end card is the "page" after the last image. */
export function PagedView({
  titleId,
  chapterId,
  pages,
  pending,
  mode,
  onToggleOverlay,
  callbacks,
  endCard,
}: {
  titleId: string;
  chapterId: string;
  pages: string[];
  pending: boolean;
  mode: PagedMode;
  onToggleOverlay: () => void;
  callbacks: ReaderCallbacks;
  endCard: ReactNode;
}) {
  const count = pages.length;
  const [index, setIndex] = useState(0);
  // Tracking starts only after the saved page is restored, so a save can never overwrite it with page 0.
  const [restored, setRestored] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    if (count === 0) return;
    let cancelled = false;
    setIndex(0);
    setRestored(false);
    db.progress.get([titleId, chapterId]).then((p) => {
      if (cancelled) return;
      if (p && !p.completed) setIndex(clampRestore(p.pageIndex, count));
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [titleId, chapterId, count]);

  usePagedTracking({ titleId, chapterId, pageCount: restored ? count : 0, index, ...callbacks });

  const go = useCallback((step: PageStep) => setIndex((i) => (step === "next" ? Math.min(i + 1, count) : Math.max(i - 1, 0))), [count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
      const step = keyAction(e.key, mode);
      if (!step) return;
      e.preventDefault();
      go(step);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, go]);

  useEffect(() => {
    for (const d of PRELOAD) {
      const src = pages[index + d];
      if (src) new Image().src = src;
    }
  }, [index, pages]);

  if (pending) {
    return (
      <div role="status" aria-label="Loading chapter" className="flex h-dvh w-full items-center justify-center">
        <span aria-hidden className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
      </div>
    );
  }

  if (index >= count) {
    return (
      <div className="min-h-dvh pt-[env(safe-area-inset-top)]">
        <div className="flex justify-center pt-16">
          <button type="button" onClick={() => go("prev")} className="press min-h-11 rounded-full border border-white/20 px-5 text-sm font-semibold text-white">
            Back to page {count}
          </button>
        </div>
        {endCard}
      </div>
    );
  }

  return (
    <div
      className="h-dvh w-full touch-pinch-zoom select-none overflow-hidden"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        swiped.current = false;
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const step = swipeAction(e.clientX - s.x, e.clientY - s.y, mode);
        if (step) {
          swiped.current = true;
          go(step);
        }
      }}
      onClick={(e) => {
        // A swipe ends with a click on the same element; it already turned the page.
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        const action = tapAction(e.clientX, window.innerWidth, mode);
        if (action === "toggle") onToggleOverlay();
        else go(action);
      }}
    >
      <ReaderPage key={pages[index]} src={pages[index]} index={index} eager fit />
    </div>
  );
}
```

- [ ] **Step 5: Add the mode switch to `ReaderOverlay`**

In `src/components/reader/ReaderOverlay.tsx`:
- Add `import { READER_MODES, type ReaderMode } from "@/lib/reader/mode";` and:

```tsx
const MODE_LABEL: Record<ReaderMode, string> = {
  strip: "Long strip",
  "paged-rtl": "Paged, right to left",
  "paged-ltr": "Paged, left to right",
};
```

- Add `mode: ReaderMode;` and `onModeChange: (m: ReaderMode) => void;` to the props type.
- In the top bar, between the title block (`<div className="min-w-0 flex-1">…</div>`) and the `{pct}%` span, insert:

```tsx
          <Dropdown
            label="Reading mode"
            value={p.mode}
            options={READER_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
            onChange={p.onModeChange}
            align="end"
            className="shrink-0"
            triggerClassName="h-11 rounded-full px-3 text-[13px] font-semibold text-fg hover:bg-surface-2"
          />
```

(The Dropdown trigger's accessible name is `` `${label}: ${selected.label}` `` — `Dropdown.tsx:173` — which the e2e matches with `/^Reading mode:/`.)

- [ ] **Step 6: Wire the mode into `Reader.tsx`**

- Imports: `import { useTitlePref } from "@/lib/db/hooks";` (merge with the existing `useSettings` import), `import { setReaderMode } from "@/lib/db/actions";` (merge with existing), `import { resolveMode, type ReaderMode } from "@/lib/reader/mode";`, `import { PagedView } from "./PagedView";`.
- After `const pages = ...`:

```tsx
  const pref = useTitlePref(titleId);
  // Wait for the title and the stored pref so the reader never flashes the wrong mode.
  const modeReady = pref !== undefined && !!t;
  const mode = resolveMode(pref?.mode, t?.layout);
  const onModeChange = useCallback((m: ReaderMode) => void setReaderMode(db, titleId, m), [titleId]);
```

- Pass `mode={mode}` and `onModeChange={onModeChange}` to `<ReaderOverlay …/>`.
- Replace the `<StripView … />` element with:

```tsx
      {!modeReady ? (
        <div role="status" aria-label="Loading chapter" className="flex h-dvh w-full items-center justify-center">
          <span aria-hidden className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
        </div>
      ) : mode === "strip" ? (
        <StripView
          titleId={titleId}
          chapterId={chapterId}
          pages={pages}
          pending={chapterQ.isPending}
          readerWidth={settings.readerWidth}
          onToggleOverlay={toggleOverlay}
          callbacks={callbacks}
          endCard={endCard}
        />
      ) : (
        <PagedView
          key={mode}
          titleId={titleId}
          chapterId={chapterId}
          pages={pages}
          pending={chapterQ.isPending}
          mode={mode}
          onToggleOverlay={toggleOverlay}
          callbacks={callbacks}
          endCard={endCard}
        />
      )}
```

- [ ] **Step 7: Run everything**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npx playwright test`
Expected: clean; all unit and e2e PASS (including the unchanged strip specs in `reader.spec.ts` on both projects).

- [ ] **Step 8: Commit**

```bash
git add src/components/reader tests/e2e/manga.spec.ts
git commit -m "feat(reader): paged right-to-left reader with per-title mode switch"
```

---

### Task 10: Docs

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-11-manga-support-design.md`

- [ ] **Step 1: Update README intro**

`README.md` line 3 → `Mobile-first manhwa & manga reader (installable PWA). Data from [MangaDex](https://mangadex.org) with an optional ScraperGo (Toonily) source for manhwa.`

- [ ] **Step 2: Align the spec's cache-key wording with the implementation**

In the spec's `kind` filter section, replace the bullet beginning "`filtersKey` **always** includes the effective kind" with:

```markdown
- `filtersKey` adds `k=manhwa` only for manhwa (so client query keys and unfiltered URLs stay clean). `SourceService` puts the effective kind into **every** list and featured cache key (`v1:md:home:manga:1:0`), so today's Korean-only entries are never served as manga and simply expire.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-11-manga-support-design.md
git commit -m "docs: manga support in README; spec cache-key note matches implementation"
```
