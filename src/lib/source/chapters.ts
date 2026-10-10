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

function numOrNull(c: Chapter): number | null {
  const n = num(c);
  return Number.isFinite(n) ? n : null;
}

/** Pick, from the chapters sharing the nearest distinct number in `dir`, the one from the same group if present. */
function pick(list: Chapter[], i: number, dir: 1 | -1): Chapter | undefined {
  const cur = list[i];
  const curN = numOrNull(cur);
  let j = i + dir;
  while (j >= 0 && j < list.length && curN !== null && numOrNull(list[j]) === curN) j += dir;
  const first = list[j];
  if (!first) return undefined;
  const n = numOrNull(first);
  if (n === null) return first; // unnumbered chapters are each distinct: positional neighbor
  const sameNumber = list.filter((c) => numOrNull(c) === n);
  return sameNumber.find((c) => cur.group !== undefined && c.group === cur.group) ?? sameNumber[0];
}

export function neighbors(chs: Chapter[], currentId: string): { prev?: Chapter; next?: Chapter } {
  const list = readableChapters(chs);
  const i = list.findIndex((c) => c.id === currentId);
  if (i === -1) return { prev: undefined, next: undefined };
  return { prev: pick(list, i, -1), next: pick(list, i, 1) };
}
