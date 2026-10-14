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
