import type { CachePolicy } from "./cached";

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const POLICIES = {
  home: { fresh: 10 * MIN, stale: 7 * DAY },
  search: { fresh: 30 * MIN, stale: 7 * DAY },
  title: { fresh: HOUR, stale: 30 * DAY },
  chapter: { fresh: 30 * DAY, stale: 90 * DAY },
  atHome: { fresh: 10 * MIN, stale: 0 },
  health: { fresh: MIN, stale: 0 },
  tags: { fresh: DAY, stale: 30 * DAY },
} satisfies Record<string, CachePolicy>;
