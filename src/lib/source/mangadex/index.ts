import type { z } from "zod";
import type { TokenBucket } from "../../ratelimit";
import { UpstreamError, InvalidIdError } from "../errors";
import type { FetchJson } from "../http";
import { encodeId } from "../ids";
import { LIMITERS } from "../limiters";
import { effectiveKind, effectiveRatings, type Kind, type SortKey, type Tag } from "../filters";
import type { ChapterPages, FeaturedItem, ListOpts, Page, Source, Title, TitleSummary } from "../types";
import { toFeatured, toSummary, toTitle } from "./normalize";
import { AtHomeSchema, FeedSchema, MangaEntitySchema, MangaListSchema, TagListSchema, type MdChapter } from "./schemas";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 24;
const FEATURED_LIMIT = 8;
const FEATURED_DAYS = 30;
const ORDER: Record<SortKey, [string, "asc" | "desc"]> = {
  latest: ["latestUploadedChapter", "desc"],
  relevance: ["relevance", "desc"],
  follows: ["followedCount", "desc"],
  newest: ["createdAt", "desc"],
  title: ["title", "asc"],
};
const LANGUAGE: Record<Kind, string> = { manga: "ja", manhwa: "ko" };
const FEED_LIMIT = 500;
const MAX_FEED_PAGES = 10;

export interface AtHome {
  baseUrl: string;
  hash: string;
  files: string[];
}

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success) {
    console.error("[mangadex] schema mismatch", r.error.issues.slice(0, 3));
    throw new UpstreamError("MangaDex response did not match schema");
  }
  return r.data;
}

export function mdChapterPages(rawId: string, chapterId: string, ah: AtHome): ChapterPages {
  return {
    titleId: encodeId("md", rawId),
    chapterId,
    pages: ah.files.map((f) => `/api/img/md/${chapterId}/${f}`),
  };
}

export class MangaDexSource implements Source {
  private base: string;
  private buckets: { general: TokenBucket; atHome: TokenBucket };

  constructor(private deps: { fetchJson: FetchJson; buckets?: { general: TokenBucket; atHome: TokenBucket }; baseUrl?: string }) {
    this.base = deps.baseUrl ?? "https://api.mangadex.org";
    this.buckets = deps.buckets ?? { general: LIMITERS.mdGeneral, atHome: LIMITERS.mdAtHome };
  }

  private listParams(page: number, opts: ListOpts, ratings: string[], hasQuery: boolean): URLSearchParams {
    const p = new URLSearchParams();
    p.append("originalLanguage[]", LANGUAGE[effectiveKind(opts)]);
    p.append("availableTranslatedLanguage[]", "en");
    p.set("hasAvailableChapters", "true");
    p.append("includes[]", "cover_art");
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String((page - 1) * PAGE_SIZE));
    for (const r of ratings) p.append("contentRating[]", r);
    for (const t of opts.tags ?? []) p.append("includedTags[]", t);
    const sort: SortKey = opts.sort === "relevance" && !hasQuery ? "latest" : opts.sort ?? (hasQuery ? "relevance" : "latest");
    const [key, dir] = ORDER[sort];
    p.set(`order[${key}]`, dir);
    return p;
  }

  private async list(p: URLSearchParams, page: number): Promise<Page<TitleSummary>> {
    const body = parse(MangaListSchema, await this.deps.fetchJson(`${this.base}/manga?${p}`, this.buckets.general));
    return { items: body.data.map(toSummary), page, hasMore: body.offset + body.limit < body.total };
  }

  private async browse(q: string | undefined, page: number, opts: ListOpts): Promise<Page<TitleSummary>> {
    const ratings = effectiveRatings(opts.mature, opts.ratings);
    // MangaDex treats an empty contentRating list as its default set, so an empty selection must not reach it.
    if (ratings.length === 0) return { items: [], page, hasMore: false };
    const p = this.listParams(page, opts, ratings, !!q);
    if (q) p.set("title", q);
    return this.list(p, page);
  }

  home(page: number, opts: ListOpts) {
    return this.browse(undefined, page, opts);
  }

  search(q: string, page: number, opts: ListOpts) {
    return this.browse(q, page, opts);
  }

  /** Featured = most followed titles of the kind that got an update in the last FEATURED_DAYS days. */
  async featured(opts: { mature: boolean; kind?: Kind; now?: () => number }): Promise<FeaturedItem[]> {
    const p = this.listParams(1, { mature: opts.mature, kind: opts.kind, sort: "follows" }, effectiveRatings(opts.mature), false);
    p.set("limit", String(FEATURED_LIMIT));
    p.delete("offset");
    // Day-aligned so the upstream query (and any CDN in front of it) is stable for a whole day.
    const since = new Date((opts.now ?? Date.now)() - FEATURED_DAYS * 86_400_000);
    p.set("updatedAtSince", `${since.toISOString().slice(0, 10)}T00:00:00`);
    const body = parse(MangaListSchema, await this.deps.fetchJson(`${this.base}/manga?${p}`, this.buckets.general));
    return body.data.map(toFeatured);
  }

  async tags(): Promise<Tag[]> {
    const body = parse(TagListSchema, await this.deps.fetchJson(`${this.base}/manga/tag`, this.buckets.general));
    return body.data
      .map((t) => ({ id: t.id, name: t.attributes.name.en ?? Object.values(t.attributes.name)[0] ?? t.id, group: t.attributes.group }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async title(rawId: string): Promise<Title> {
    if (!UUID_RE.test(rawId)) throw new InvalidIdError();
    const mp = new URLSearchParams();
    for (const inc of ["author", "artist", "cover_art"]) mp.append("includes[]", inc);
    const manga = parse(MangaEntitySchema, await this.deps.fetchJson(`${this.base}/manga/${rawId}?${mp}`, this.buckets.general));

    const chapters: MdChapter[] = [];
    for (let i = 0, offset = 0; i < MAX_FEED_PAGES; i++) {
      const fp = new URLSearchParams();
      fp.append("translatedLanguage[]", "en");
      fp.set("order[chapter]", "asc");
      fp.append("includes[]", "scanlation_group");
      fp.set("limit", String(FEED_LIMIT));
      fp.set("offset", String(offset));
      for (const r of ["safe", "suggestive", "erotica", "pornographic"]) fp.append("contentRating[]", r);
      const feed = parse(FeedSchema, await this.deps.fetchJson(`${this.base}/manga/${rawId}/feed?${fp}`, this.buckets.general));
      chapters.push(...feed.data);
      offset = feed.offset + feed.limit;
      if (offset >= feed.total || feed.data.length === 0) break;
    }
    return toTitle(manga.data, chapters);
  }

  async atHome(chapterId: string): Promise<AtHome> {
    if (!UUID_RE.test(chapterId)) throw new InvalidIdError();
    const body = parse(AtHomeSchema, await this.deps.fetchJson(`${this.base}/at-home/server/${chapterId}`, this.buckets.atHome));
    return { baseUrl: body.baseUrl, hash: body.chapter.hash, files: body.chapter.data };
  }

  async chapter(rawId: string, chapterId: string): Promise<ChapterPages> {
    if (!UUID_RE.test(rawId)) throw new InvalidIdError();
    return mdChapterPages(rawId, chapterId, await this.atHome(chapterId));
  }
}
