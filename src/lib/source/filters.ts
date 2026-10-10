/** Browse/search filters shared by the API routes, the sources and the client. */
import type { SourceKey } from "./ids";

export const SORT_KEYS = ["latest", "relevance", "follows", "newest", "title"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const RATINGS = ["safe", "suggestive", "erotica", "pornographic"] as const;
export type Rating = (typeof RATINGS)[number];

const MATURE_RATINGS: ReadonlySet<Rating> = new Set(["erotica", "pornographic"]);

export const KINDS = ["manga", "manhwa"] as const;
export type Kind = (typeof KINDS)[number];
export const DEFAULT_KIND: Kind = "manga";

/** Which catalog kinds each source can list. */
const SOURCE_KINDS: Record<SourceKey, readonly Kind[]> = { md: KINDS, sg: ["manhwa"], mock: KINDS };

export const sourceSupportsKind = (source: SourceKey, kind: Kind) => SOURCE_KINDS[source].includes(kind);

export const effectiveKind = (f: { kind?: Kind }): Kind => f.kind ?? DEFAULT_KIND;

export interface Filters {
  /** Catalog kind; absent means DEFAULT_KIND. parseFilters never stores the default. */
  kind?: Kind;
  sort?: SortKey;
  tags?: string[];
  ratings?: Rating[];
}

export interface Tag {
  id: string;
  name: string;
  group: string;
}

const TAG_RE = /^[A-Za-z0-9-]{1,64}$/;
const MAX_TAGS = 10;

const isSort = (s: string): s is SortKey => (SORT_KEYS as readonly string[]).includes(s);
const isRating = (s: string): s is Rating => (RATINGS as readonly string[]).includes(s);
const isKind = (s: string): s is Kind => (KINDS as readonly string[]).includes(s);

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags)].sort();
}

function normalizeRatings(ratings: Rating[]): Rating[] {
  return RATINGS.filter((r) => ratings.includes(r));
}

/** Parse `kind`, `sort`, `tags` (comma list) and `rating` (comma list). Returns null when any value is invalid. */
export function parseFilters(sp: URLSearchParams): Filters | null {
  const out: Filters = {};
  const kind = sp.get("kind");
  if (kind) {
    if (!isKind(kind)) return null;
    if (kind !== DEFAULT_KIND) out.kind = kind;
  }
  const sort = sp.get("sort");
  if (sort) {
    if (!isSort(sort)) return null;
    out.sort = sort;
  }
  const tags = sp.get("tags");
  if (tags) {
    const list = tags.split(",").filter(Boolean);
    if (list.length > MAX_TAGS || !list.every((t) => TAG_RE.test(t))) return null;
    out.tags = normalizeTags(list);
  }
  const rating = sp.get("rating");
  if (rating) {
    const list = rating.split(",").filter(Boolean);
    if (!list.every(isRating)) return null;
    out.ratings = normalizeRatings(list as Rating[]);
  }
  return out;
}

/** Ratings to request: the selection (default: all) clipped by the 18+ setting. */
export function effectiveRatings(mature: boolean, ratings?: Rating[]): Rating[] {
  const allowed = RATINGS.filter((r) => mature || !MATURE_RATINGS.has(r));
  return ratings ? allowed.filter((r) => ratings.includes(r)) : allowed;
}

/** Canonical cache-key fragment; "" when no filters are set. */
export function filtersKey(f: Filters): string {
  const parts: string[] = [];
  if (f.sort) parts.push(`s=${f.sort}`);
  if (f.tags?.length) parts.push(`t=${normalizeTags(f.tags).join(",")}`);
  if (f.ratings) parts.push(`r=${normalizeRatings(f.ratings).join(",")}`);
  if (effectiveKind(f) !== DEFAULT_KIND) parts.push(`k=${effectiveKind(f)}`);
  return parts.join(";");
}

/** Query string fragment (no leading "?" or "&"); "" when no filters are set. */
export function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (effectiveKind(f) !== DEFAULT_KIND) p.set("kind", effectiveKind(f));
  if (f.sort) p.set("sort", f.sort);
  if (f.tags?.length) p.set("tags", normalizeTags(f.tags).join(","));
  if (f.ratings?.length) p.set("rating", normalizeRatings(f.ratings).join(","));
  return p.toString().replace(/%2C/g, ",");
}

export const hasFilters = (f: Filters) => !!(f.sort || f.tags?.length || f.ratings?.length);

/** "Clear all": drop every filter but stay in the current catalog kind. */
export const clearFilters = (f: Filters): Filters => (effectiveKind(f) === DEFAULT_KIND ? {} : { kind: effectiveKind(f) });
