import { filtersToSearch, parseFilters, type Filters } from "../source/filters";
import type { SourceKey } from "../source/ids";

/** Home is the single browse surface: `/?q=&sort=&tags=&rating=`. */
export interface BrowseState {
  q: string;
  filters: Filters;
}

export const MIN_QUERY = 2;

export const isSearching = (q: string) => q.trim().length >= MIN_QUERY;

export function readBrowse(sp: URLSearchParams): BrowseState {
  return { q: sp.get("q") ?? "", filters: parseFilters(sp) ?? {} };
}

export function browseHref(q: string, filters: Filters): string {
  const p = new URLSearchParams();
  const term = q.trim();
  if (term) p.set("q", term);
  const qs = [p.toString(), filtersToSearch(filters)].filter(Boolean).join("&");
  return qs ? `/?${qs}` : "/";
}

export function browseApiPath(o: BrowseState & { page: number; mature: boolean; source: SourceKey }): string {
  const term = o.q.trim();
  const base = isSearching(term) ? `/api/search?q=${encodeURIComponent(term)}&` : "/api/home?";
  const f = filtersToSearch(o.filters);
  return `${base}page=${o.page}&mature=${o.mature ? 1 : 0}&source=${o.source}${f ? `&${f}` : ""}`;
}
