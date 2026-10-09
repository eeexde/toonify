# Toonify — Design Spec

Date: 2026-10-10
Status: Draft for review

## 1. Goal

Toonify is a mobile-first manhwa reader delivered as an installable PWA that also works well on desktop browsers. It is a fresh build (no prior codebase). Users browse, search, read chapters in a vertical long-strip reader, and keep a local library and reading history.

### Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Platform | PWA, single Next.js codebase, mobile-first responsive |
| Data source | Pluggable `Source` adapter. MangaDex = primary. ScraperGo = secondary. MockSource = dev/test only |
| User data | Local only (IndexedDB). No accounts. JSON export/import for backup |
| 18+ content | Off by default; enabled via Settings toggle with an age confirmation |
| Upstream protection | Mandatory multi-layer caching + outbound rate limiting so we never get rate limited |

### Context

- ScraperGo (`https://scrapergo.vercel.app`) scrapes toonily.com. As of 2026-10-10 every endpoint returns `success:false` (toonily returns HTTP 403 to scrapers). It is kept as a secondary adapter in case it recovers.
- MangaDex API (`https://api.mangadex.org`) was verified live on 2026-10-10: search, feeds, at-home server, and image download all work. ~5,368 Korean-original series have English chapters. Licensed titles often only have external-link chapters (`pages: 0`, `externalUrl` set) that cannot be read in-app.

### Out of scope (v1)

Accounts/sync, comments, push notifications, offline chapter downloads, multiple translation languages (English only), ads or any paid feature (MangaDex terms).

## 2. Architecture

```
browser (PWA)
  ├─ Next.js App Router pages (RSC + client components), Tailwind CSS
  ├─ TanStack Query (cache persisted to IndexedDB)
  ├─ Dexie (IndexedDB): library, history, progress, settings
  └─ Service worker (Serwist): app shell precache + runtime image cache
        │  same-origin /api/*
        ▼
Next.js route handlers (server)
  └─ SourceService (routes by id prefix)
        ├─ cached(): SWR + request coalescing + stale-on-error
        │     └─ CacheStore: UpstashStore (if env set) | MemoryLRUStore
        ├─ TokenBucket limiters (per upstream)
        └─ Source implementations
              ├─ MangaDexSource  (md:)
              ├─ ScraperGoSource (sg:)
              └─ MockSource      (mock:, only when SOURCE_MODE=mock)
```

The browser never calls an upstream directly. All upstream traffic goes through our server, so the cache is shared across all users.

### Module layout

```
src/
  app/
    page.tsx                       # Home
    search/page.tsx
    title/[titleId]/page.tsx
    read/[titleId]/[chapterId]/page.tsx
    library/page.tsx               # Library + History tabs
    settings/page.tsx
    api/
      home/route.ts                # ?page=&mature=&source=
      search/route.ts              # ?q=&page=&mature=&source=
      title/[titleId]/route.ts
      chapter/[titleId]/[chapterId]/route.ts
      img/[...path]/route.ts       # image proxy
      health/route.ts
  lib/
    source/
      types.ts                     # normalized types + Source interface
      ids.ts                       # prefix encode/decode
      mangadex/{client,schemas,normalize,index}.ts
      scrapergo/{client,schemas,normalize,index}.ts
      mock/{fixtures/*.json,index}.ts
      service.ts                   # SourceService
    cache/{store,memory,upstash,cached}.ts
    ratelimit.ts
    db/{schema,hooks,backup}.ts
    query/{client,hooks}.ts
  components/                      # UI components
```

Units have one purpose each and talk through typed interfaces. The UI only knows the normalized types, never raw upstream shapes.

## 3. Normalized types and Source interface

```ts
type TitleId = string;   // "md:<uuid>" | "sg:<slug>" | "mock:<id>"
type ChapterId = string; // opaque, source-specific

interface TitleSummary { id: TitleId; title: string; cover: string; latest?: { label: string; date?: string }[]; badge?: string }
interface Page<T> { items: T[]; page: number; hasMore: boolean }
interface Chapter { id: ChapterId; number?: string; name: string; date?: string; group?: string; externalUrl?: string }
interface Title { id: TitleId; title: string; altTitles: string[]; cover: string; summary: string; status?: string;
                  authors: string[]; artists: string[]; genres: string[]; contentRating?: string; chapters: Chapter[] }
interface ChapterPages { titleId: TitleId; chapterId: ChapterId; title: string; pages: string[]; group?: string }

interface Source {
  home(page: number, opts: { mature: boolean }): Promise<Page<TitleSummary>>;
  search(q: string, page: number, opts: { mature: boolean }): Promise<Page<TitleSummary>>;
  title(id: string): Promise<Title>;            // id without prefix
  chapter(id: string, chapterId: string): Promise<ChapterPages>;
}
```

`chapters` is sorted ascending by number. `pages` and `cover` are URLs the browser can load directly (same-origin proxy URLs for MangaDex).

## 4. Sources

### 4.1 MangaDexSource (primary)

All requests send `User-Agent: toonify/<version> (+<repo url>)`. No `Via` header.

| Method | Upstream call |
|---|---|
| home | `GET /manga?originalLanguage[]=ko&availableTranslatedLanguage[]=en&hasAvailableChapters=true&order[latestUploadedChapter]=desc&includes[]=cover_art&limit=24&offset=(page-1)*24&contentRating[]=safe&contentRating[]=suggestive` (+ `erotica`, `pornographic` when mature) |
| search | same as home plus `title=<q>`, ordered by `relevance` |
| title | `GET /manga/{id}?includes[]=author&includes[]=artist&includes[]=cover_art` + `GET /manga/{id}/feed?translatedLanguage[]=en&order[chapter]=asc&includes[]=scanlation_group&limit=500&offset=…` (paged until done) |
| chapter | `GET /at-home/server/{chapterId}` → `baseUrl`, `chapter.hash`, `chapter.data[]` |

- `hasMore` = `offset + limit < total`.
- Duplicate chapters (same number, several groups): keep all, label with group name.
- Chapters with `pages === 0` and `externalUrl` become `Chapter.externalUrl` and show as "Official ↗" links, not readable in-app.
- Title is the `en` title if present, else first `en` altTitle, else first available title.
- Covers: `/api/img/cover/{mangaId}/{fileName}.512.jpg`.
- Pages: `/api/img/md/{chapterId}/{fileName}` (stable, contains no expiring `baseUrl`).

### 4.2 ScraperGoSource (secondary)

Maps the documented endpoints:
- home → `GET /api/manwha/home/{page}?mature=0|1` (`hasMore` from `pagination` array)
- search → `GET /api/search/{q}/{page}?mature=0|1`
- title → `GET /api/manwha/{manwhaId}`
- chapter → `GET /api/manwha/{manwhaId}/{chapter}` (chapter number derived from `chapterId` or chapter name; to be verified when the API returns)

`success:false` responses are treated as upstream errors. Images are the URLs ScraperGo returns (already proxied by them).

### 4.3 MockSource

Serves JSON fixtures (a handful of titles, chapters with placeholder images generated locally as SVG). Active only when `SOURCE_MODE=mock`; used for e2e tests and offline development.

### 4.4 Source selection

`SourceService` routes by id prefix. For list endpoints (`home`, `search`) the source is `?source=` or the default `md`. The UI shows MangaDex results; ScraperGo appears as a source switcher option in Settings only when `/api/health` reports it healthy.

## 5. Caching and rate limiting

Goal: never be rate limited by any upstream, and stay useful when an upstream is down.

### 5.1 Server cache — `cached(key, policy, fn)`

| Data | Fresh TTL | Stale kept for |
|---|---|---|
| home list | 10 min | 7 days |
| search | 30 min | 7 days |
| title details + chapter list | 1 h | 30 days |
| chapter page list (hash + files / image URLs) | 30 days | 90 days |
| MangaDex at-home `baseUrl` | 10 min | none |
| health status | 1 min | none |

Behavior:
1. Fresh hit → return.
2. Stale hit → return immediately, refresh in background (one refresh at a time per key).
3. Miss → call upstream; concurrent callers for the same key share one in-flight promise (coalescing).
4. Upstream error / schema failure → return stale if present (response flagged `stale: true`), else throw. Errors are never cached.

`CacheStore` interface: `get(key)`, `set(key, value, ttlSeconds)`. `UpstashStore` is used when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set; otherwise `MemoryLRUStore` (max ~500 entries). Keys are namespaced: `v1:<source>:<kind>:<args>`.

### 5.2 HTTP cache headers

API JSON responses: `Cache-Control: public, s-maxage=<fresh TTL>, stale-while-revalidate=<stale window>` so the Vercel CDN absorbs repeat requests. Image proxy responses: `public, max-age=31536000, immutable`.

### 5.3 Outbound rate limiting

Token bucket per upstream, enforced in-process before every upstream call:
- MangaDex general: 4 req/s, burst 4.
- MangaDex at-home: 30 req/min.
- ScraperGo: 1 req/s, burst 5.

If no token is available within 3 s, the call fails as "rate limited" and the stale-on-error path applies. Upstream `429` responses: honor `Retry-After` by pausing that bucket.

Note: on serverless, buckets are per instance. Combined with the shared cache, coalescing, and CDN caching, upstream volume stays far below the limits for expected traffic.

### 5.4 Client cache

- TanStack Query `staleTime` matches server fresh TTLs; query cache persisted to IndexedDB via `@tanstack/query-async-storage-persister` + `idb-keyval`, so revisits and back-navigation do not refetch.
- Service worker runtime cache for `/api/img/*`: CacheFirst, max ~2000 entries / LRU expiration, so recently read chapters and covers load without network.

## 6. Image proxy — `/api/img/[...path]`

- `md/{chapterId}/{file}`: look up the chapter's `hash` (cached 30 days) and current at-home `baseUrl` (cached 10 min) via `/at-home/server/{chapterId}`, verify `file` is in the chapter's file list, then fetch `{baseUrl}/data/{hash}/{file}`. On failure, refresh `baseUrl` once and retry; final fallback `https://uploads.mangadex.org/data/{hash}/{file}`.
- `cover/{mangaId}/{file}`: fetch `https://uploads.mangadex.org/covers/{mangaId}/{file}`.
- Only hosts `*.mangadex.network` and `uploads.mangadex.org` are fetched. Path segments are validated against strict patterns (UUID chapter/manga id, safe filename). Anything else → 400. This prevents use as an open proxy.
- Streams the body through; passes `Content-Type`; sets immutable cache headers.

## 7. Local data (Dexie)

| Table | Key | Fields |
|---|---|---|
| library | titleId | title, cover, addedAt, lastChapterSeenId |
| history | titleId | title, cover, chapterId, chapterName, readAt |
| progress | [titleId+chapterId] | scrollRatio, completed, updatedAt |
| settings | key | value (mature, matureConfirmedAt, theme, readerWidth, source) |

History keeps one row per title (latest chapter read). Export: JSON `{ version: 1, exportedAt, library, history, progress, settings }`. Import validates with zod and merges (newer `updatedAt`/`readAt` wins). If IndexedDB is unavailable, fall back to in-memory storage and show a warning toast.

## 8. Screens

- **Home** (`/`): "Continue reading" row from history (hidden when empty), then "Latest updates" grid with infinite scroll. Mobile: 3 columns; desktop: 5–6.
- **Search** (`/search`): input debounced 400 ms, min 2 chars, results grid, query in URL (`?q=`).
- **Title** (`/title/[titleId]`): cover, title, authors/artists, genres chips, status, expandable summary, Add/Remove library button, "Start reading" / "Continue ch. X" button, chapter list with read markers, sort asc/desc toggle, group label, external chapters shown as "Official ↗".
- **Reader** (`/read/[titleId]/[chapterId]`): see §9.
- **Library** (`/library`): tabs Library / History. Grid with a "new chapters" dot when the title's latest chapter differs from `lastChapterSeenId` (checked when the title page is visited).
- **Settings** (`/settings`): 18+ toggle (confirmation dialog on enable), theme (dark default / light / system), reader width (desktop), export / import, clear image cache, source info + MangaDex credit.
- **Navigation**: bottom tab bar on mobile (Home, Search, Library, Settings); top bar on desktop (≥ 768 px).
- **Status banner**: shown when any response carries `stale: true` — "Source unavailable — showing cached data."

## 9. Reader

- Vertical long-strip, full-bleed on mobile; centered column at `readerWidth` (default 720 px) on desktop.
- Images: `loading="lazy"` except the first 3; reserved placeholder height until loaded; per-image error state with Retry.
- Tap center third toggles overlay: back, title + chapter name, chapter picker, prev/next, scroll progress bar. Overlay auto-hides on scroll.
- Progress: save `scrollRatio` every 2 s while scrolling and on `visibilitychange`/`pagehide`. On open, restore saved ratio after images above the target have placeholders.
- At ≥ 95% scroll: mark chapter `completed`, upsert history, update library `lastChapterSeenId`.
- At ≥ 70% scroll: prefetch next chapter's page list and warm its first 3 images.
- End of chapter: "Next chapter" card; scanlation group credit + "via MangaDex" line.
- Desktop keyboard: ↑/↓/Space scroll, `[` / `]` previous/next chapter.
- Next/prev skip external-only chapters.

## 10. Error handling

| Case | Behavior |
|---|---|
| Upstream down, stale data exists | Serve stale, `stale: true`, status banner |
| Upstream down, no data | Route returns 502 `{ error }`; UI shows error state with Retry |
| Schema drift (zod fails) | Logged, treated as upstream error, never cached |
| Upstream 429 | Honor `Retry-After`, serve stale |
| Image load failure | Per-image Retry; proxy retries once with fresh `baseUrl` |
| Title/chapter not found | 404 page with link home |
| Bad import file | Rejected with message; no partial writes |
| IndexedDB unavailable | Memory fallback + warning toast |

## 11. PWA

Serwist service worker: precache app shell; runtime caching for `/api/img/*` (CacheFirst) and pages (NetworkFirst). Web app manifest with name "Toonify", dark theme color, standalone display, maskable icons. Offline fallback page.

## 12. Dev and deployment

- Next.js 15 (App Router), TypeScript strict, Tailwind CSS, TanStack Query, Dexie, zod, Serwist, Vitest, Playwright.
- `next.config` sets `allowedDevOrigins: ['192.168.*.*', '100.*.*.*', '**.ts.net']` so the dev server is reachable on LAN and Tailscale.
- Env: `SOURCE_MODE` (`live` | `mock`, default `live`), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (optional), `APP_URL` (for User-Agent).
- Target deploy: Vercel (Upstash free tier recommended there). Also runs on any Node host with the memory cache.

## 13. Testing

- **Unit (Vitest)**: `cached()` (fresh, stale+background refresh, coalescing, stale-on-error, errors not cached); token bucket (refill, burst, wait timeout, Retry-After pause); MangaDex normalizers against recorded fixture JSON (including external-only chapters, missing en title, multi-group chapters); ScraperGo normalizers; id prefix codec; image proxy path validation; backup import validation and merge.
- **Route handlers**: called with a stubbed `SourceService`; verify status codes, `stale` flag, cache headers.
- **E2E (Playwright, mobile viewport, `SOURCE_MODE=mock`)**: home → title → reader; progress resume; mark read at end; next chapter; add to library; history; 18+ toggle confirm; export then import; desktop viewport smoke.
- **Manual live smoke** against MangaDex before completion: home, search, title, read one chapter, verify images load through the proxy.

## 14. Attribution and terms

- App footer and Settings: "Data provided by MangaDex" with link.
- Reader end card: scanlation group name(s).
- No ads, no paid features.
- External-only (licensed) chapters link out to the official site.

## 15. Risks

- MangaDex coverage of popular licensed manhwa is limited to external links.
- MangaDex at-home rate limit figure (~40/min) is from third-party docs; our 30/min bucket is conservative.
- ScraperGo chapter-number mapping is unverified until the API recovers.
- Image proxy bandwidth on Vercel free tier; mitigated by immutable CDN caching and the service worker cache.
