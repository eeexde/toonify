export const THRESHOLDS = { prefetch: 0.7, complete: 0.95 } as const;

export function scrollRatio(scrollY: number, docHeight: number, viewport: number): number {
  const max = docHeight - viewport;
  if (max <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / max));
}

export function currentPageIndex(tops: number[]): number {
  let idx = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= 1) idx = i;
  return idx;
}
