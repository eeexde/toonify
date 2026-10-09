import type { Chapter } from "./types";

function num(c: Chapter): number {
  const n = c.number === undefined ? NaN : parseFloat(c.number);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

export function sortChapters(chs: Chapter[]): Chapter[] {
  return chs
    .map((c, i) => ({ c, i }))
    .sort((a, b) => num(a.c) - num(b.c) || a.i - b.i)
    .map(({ c }) => c);
}

export function readableChapters(chs: Chapter[]): Chapter[] {
  return chs.filter((c) => !c.externalUrl);
}

export function neighbors(chs: Chapter[], currentId: string): { prev?: Chapter; next?: Chapter } {
  const list = readableChapters(chs);
  const i = list.findIndex((c) => c.id === currentId);
  if (i === -1) return { prev: undefined, next: undefined };
  return { prev: list[i - 1], next: list[i + 1] };
}
