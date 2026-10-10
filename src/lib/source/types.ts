import type { Filters, Kind, Tag } from "./filters";

export type TitleId = string;
export type ChapterId = string;

export interface TitleSummary {
  id: TitleId;
  title: string;
  cover: string;
  latest?: { label: string; date?: string }[];
  badge?: string;
  /** Series publication status, e.g. "ongoing", "completed", "hiatus", "cancelled". */
  status?: string;
}

/** A title promoted in the Home banner. */
export interface FeaturedItem extends TitleSummary {
  summary: string;
  genres: string[];
}

export interface Page<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}

export interface Chapter {
  id: ChapterId;
  number?: string;
  name: string;
  date?: string;
  group?: string;
  externalUrl?: string;
}

export interface Title {
  id: TitleId;
  title: string;
  altTitles: string[];
  cover: string;
  summary: string;
  status?: string;
  authors: string[];
  artists: string[];
  genres: string[];
  contentRating?: string;
  /** Absent in titles cached before manga support; readers treat that as "strip". */
  layout?: Layout;
  chapters: Chapter[];
}

export interface ChapterPages {
  titleId: TitleId;
  chapterId: ChapterId;
  pages: string[];
}

/** How a title's pages are meant to be read: a vertical strip (manhwa) or one page at a time (manga). */
export type Layout = "strip" | "paged";

export interface ListOpts extends Filters {
  mature: boolean;
}

/** Ids passed to a Source are raw (prefix already stripped). */
export interface Source {
  home(page: number, opts: ListOpts): Promise<Page<TitleSummary>>;
  search(q: string, page: number, opts: ListOpts): Promise<Page<TitleSummary>>;
  title(rawId: string): Promise<Title>;
  chapter(rawId: string, chapterId: ChapterId): Promise<ChapterPages>;
  /** Filterable tags. Sources without it do not support sort/tag/rating filters. */
  tags?(): Promise<Tag[]>;
  /** Titles for the Home banner. `now` is injectable for tests. */
  featured?(opts: { mature: boolean; kind?: Kind; now?: () => number }): Promise<FeaturedItem[]>;
}
