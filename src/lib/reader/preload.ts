/** Pages to load ahead of (and behind) the one being read. */
export const PRELOAD_AHEAD = 3;
export const PRELOAD_BEHIND = 1;

/** Indexes to preload around `index`, nearest-ahead first, clamped to the chapter. */
export function preloadIndexes(index: number, count: number, ahead = PRELOAD_AHEAD, behind = PRELOAD_BEHIND): number[] {
  const out: number[] = [];
  for (let d = 1; d <= ahead; d++) if (index + d < count) out.push(index + d);
  for (let d = 1; d <= behind; d++) if (index - d >= 0) out.push(index - d);
  return out;
}

type Img = Pick<HTMLImageElement, "src" | "decode">;

/**
 * Fetches and decodes pages off-screen. It holds the Image objects for the current window so
 * the browser can't drop them mid-download, and lets go of pages that leave the window.
 */
export function createPreloader(make: () => Img = () => new Image()) {
  const held = new Map<string, Img>();
  return {
    held,
    set(srcs: string[]) {
      const keep = new Set(srcs);
      for (const src of held.keys()) if (!keep.has(src)) held.delete(src);
      for (const src of srcs) {
        if (held.has(src)) continue;
        const img = make();
        img.src = src;
        // Decoding early means the page paints at once when turned to; failures surface on the real <img>.
        img.decode?.().catch(() => {});
        held.set(src, img);
      }
    },
    clear() {
      held.clear();
    },
  };
}
