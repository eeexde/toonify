# Toonify UI redesign — "Lamplight"

## Direction

Reading webtoons happens at night, on a phone, in bed. Lamplight treats the app as a dim aubergine room lit by one amber reading lamp: deep violet-black surfaces, warm paper-white text, and a single amber accent that marks the one thing to do next (continue, start, next chapter, the active tab). Titles use a condensed signage face that echoes webtoon logo lettering; everything else uses a highly legible humanist sans so chapter lists and metadata stay readable at small sizes. The light theme keeps the same structure on cool lilac paper with a burnt-amber accent. The reader itself gets out of the way: pages run edge to edge on black, and its chrome is a floating island that is quick to summon and dismiss.

## Tokens

All component code uses CSS variables from `src/app/globals.css`, mapped to Tailwind colors via `@theme inline`.

### Color

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#15121b` | `#f7f5f9` | Page background |
| `--card` | `#1f1a27` | `#ffffff` | Cards, rows, sheets |
| `--surface-2` | `#2a2433` | `#eeeaf2` | Inputs, pressed states, skeleton base |
| `--line` | `#3a3245` | `#ddd6e3` | Decorative hairlines |
| `--line-strong` | `#7a7085` | `#8e8598` | Control boundaries (≥ 3:1 on bg) |
| `--fg` | `#f3ece2` | `#1d1824` | Body text |
| `--muted` | `#aba1b5` | `#615869` | Secondary text |
| `--accent` | `#ffb23f` | `#f2a22c` | Primary fills (CTA, active tab, progress) |
| `--accent-fg` | `#241603` | `#241603` | Text on accent fills |
| `--accent-text` | `#ffc266` | `#9a5300` | Accent used as text on bg |
| `--accent-soft` | amber 14% | amber 16% | Tinted backgrounds (active tab pill, last-read row) |
| `--danger` | `#ff7a6b` | `#b42318` | Errors |
| `--warn-bg` / `--warn-fg` | amber 12% / `#ffd08a` | `#fff1d6` / `#6b3d00` | Stale-data banner |
| `--scrim` | ink 66% | ink 50% | Dialog backdrop |
| `--chrome` | bg 86% | bg 90% | Translucent bars (with backdrop blur) |
| `--shadow`, `--glow` | | | Card elevation; amber glow on the primary CTA and continue card |

`system` theme uses the light values under `prefers-color-scheme: light`.

### Type

- Display: **Big Shoulders** (variable, `opsz` 72, weight 800, line-height 0.95) via the `.display` class — page titles, section headings, title name, end-of-chapter heading.
- Body: **Atkinson Hyperlegible Next** — all UI text, chapter lists, metadata.
- Both loaded with `next/font/google`, `display: swap`.

### Shape, motion

- Radii: covers `10px` (`--radius-cover`); cards and sheets rounded-2xl; buttons and segmented controls fully rounded.
- Easing: `--ease-out-soft` `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- `.press`: 120 ms scale to 0.97 on `:active` for touch feedback.
- `.skeleton`: a slow 1.6 s "lamp sweep" gradient instead of a blinking pulse.
- `fade` / `rise` keyframes for sheets and toasts.
- `prefers-reduced-motion: reduce` disables these animations and transitions.

## Screens

- **App shell** — wordmark with a stacked-pages mark; desktop top bar with pill-highlighted active link; mobile bottom tab bar with an amber pill behind the active icon, safe-area padding, 56px targets. Reader route hides both.
- **Home** — "Continue reading" is a single glowing card (cover, title, chapter, progress bar with %) rather than a cramped carousel, so the primary action is obvious; "Latest updates" grid with rounded covers, soft elevation and 18+ / new badges.
- **Search** — large rounded field with icon; result count line ("1 match for bak"); designed empty, short-query and no-results states with guidance copy.
- **Title** — hero with cover, status chip, display-face title, credits and genre chips; full-width amber primary CTA ("Start reading" / "Continue Ch. N") beside the library toggle; chapter list rendered as a vertical "spine": a line with nodes, read chapters checked and dimmed, the last-read row tinted and labelled, external chapters marked with an "Official ↗" pill; read count ("1 of 3 read") and a sort toggle.
- **Reader** — top bar (back, title, chapter, % read) and a floating bottom island (prev, chapter select, next) that fade together on center tap and hide on scroll down; a thin amber progress bar at the very top; end-of-chapter card with display heading "End of Ch. N", scanlation credit, glowing "Next: Ch. N" button and "Back to title"; "You're caught up" state at the last readable chapter.
- **Library / History** — segmented tabs; library grid with new-chapter dots; history rows with cover, title, chapter and date; designed empty states.
- **Settings** — grouped cards (Reading, Content, Your data); Theme and Reader width as segmented radio groups (keyboard arrows supported); 18+ switch; Export / Import / Clear as outlined icon buttons; 18+ confirmation as a mobile bottom sheet (centered dialog on desktop) with blurred backdrop.
- **States** — shared `EmptyState` (icon, title, body, optional action), error state with retry, skeletons using the sweep, toasts themed to the tokens, stale-data banner in warn colors, Not found and Offline pages in the same voice.

## Header search and filters (follow-up)

- **Search in the header.** One search field in the sticky header on every page except the reader (phone: mark + field; desktop: wordmark, nav links, field). Typing (350 ms debounce) drives Home through the URL (`/?q=`); from another page it navigates to Home. The Search tab is gone (bottom nav: Home, Library, Settings) and `/search?q=` redirects to `/?q=`.
- **Home is the single browse surface.** No query and no filters: Continue reading + Latest updates. A 2+ character query or any filter: Results / Browse with infinite scroll; Continue reading is hidden.
- **Filters** (`/?sort=&tags=&rating=`, shareable, back-button friendly): a bar with a Filters button (active count), a Sort select and removable chips for active genres/ratings plus Clear all; a bottom sheet (dialog on desktop) with Sort by, Content rating (mature ratings only listed when 18+ is on; the 18+ setting still clips any selection) and tags grouped Genres / Themes / Format / Content from `/api/tags`. Hidden for sources without tag support (ScraperGo).
- **Status chip** on every cover (bottom-left, same treatment as the 18+ badge): Ongoing (amber dot), Completed (green), Hiatus (blue), Cancelled (red).

## Accessibility

- Contrast (computed from tokens): dark fg/bg 15.8:1, muted/bg 7.5:1, muted/card 6.9:1, accent-text/bg 11.6:1, accent-fg/accent 9.8:1; light fg/bg 16.0:1, muted/bg 6.2:1, accent-text/bg 5.4:1, accent-fg/accent 8.4:1; control boundaries (`--line-strong`) ≥ 3.25:1. All text pairs meet WCAG AA.
- One focus treatment everywhere: 2px amber `:focus-visible` outline with offset, visible on images and both themes.
- Touch targets ≥ 44px; bottom bars respect `env(safe-area-inset-*)`.
- Semantic roles kept: `navigation`, `switch`, `radiogroup`/`radio`, `dialog` with `aria-modal`, `progressbar`, `status` for empty/stale states; images have alt text in the reader.
- Reduced motion honored.

## Verification

- `npx vitest run`: 130/130; `npx tsc --noEmit`, `npx eslint src tests`: clean.
- `npx playwright test --workers=1`: 12/12, e2e specs unchanged.
- Production build OK; screenshots in `screenshots/` taken from the production build in mock mode (`{mobile 390×844, desktop 1280×800} × {dark, light}` × home, search results, search empty, title, reader overlay, reader end, library, settings, 18+ dialog).

## Known limitations

- `next build` warns that it cannot find font override (fallback metric) values for Atkinson Hyperlegible Next and Big Shoulders, so the swap from fallback to web font may shift layout slightly on first load.
- "Continue reading" shows the last opened chapter even when it is completed (100%); pointing it at the next chapter needs a data-layer change, out of scope for this UI pass.
