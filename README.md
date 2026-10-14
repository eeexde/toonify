# Toonify

Mobile-first manhwa & manga reader (installable PWA). Data from [MangaDex](https://mangadex.org), with an opt-in ScraperGo (Toonily) source for manhwa.

## Run

    npm install
    npm run dev          # live sources, http://localhost:3000 (also reachable on LAN/Tailscale)
    npm run dev:mock     # offline fixtures

## Test

    npm test             # unit
    npm run e2e          # Playwright (mock mode)

## Config (.env.local)

| Var | Purpose |
|---|---|
| SOURCE_MODE | `live` (default) or `mock` |
| SOURCE_SCRAPERGO | `1` enables the ScraperGo (Toonily) source. Off by default; keep it off on public deploys. |
| APP_URL | Public URL, sent in the MangaDex User-Agent |
| UPSTASH_REDIS_REST_URL / _TOKEN | Shared server cache and per-IP rate limits (recommended on Vercel). Falls back to in-memory. |
| CONTACT_EMAIL | Optional takedown/contact address shown on `/about` |

## Caching

All upstream calls go through `/api/*` with a stale-while-revalidate cache, request coalescing, stale-on-error, and per-upstream token buckets. Images are proxied via `/api/img/*` with immutable CDN caching and a service-worker cache.

## Credits

Data provided by MangaDex. Chapters belong to their scanlation groups. No ads, no paid features.
