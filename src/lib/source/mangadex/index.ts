import type { z } from "zod";
import type { TokenBucket } from "../../ratelimit";
import { UpstreamError, InvalidIdError } from "../errors";
import type { FetchJson } from "../http";
import { encodeId } from "../ids";
import { LIMITERS } from "../limiters";
import type { ChapterPages, ListOpts, Page, Source, Title, TitleSummary } from "../types";
import { toSummary, toTitle } from "./normalize";
import { AtHomeSchema, FeedSchema, MangaEntitySchema, MangaListSchema, type MdChapter } from "./schemas";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 24;
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

export class MangaDexSource implements Source {
  private base: string;
  private buckets: { general: TokenBucket; atHome: TokenBucket };

  constructor(private deps: { fetchJson: FetchJson; buckets?: { general: TokenBucket; atHome: TokenBucket }; baseUrl?: string }) {
    this.base = deps.baseUrl ?? "https://api.mangadex.org";
    this.buckets = deps.buckets ?? { general: LIMITERS.mdGeneral, atHome: LIMITERS.mdAtHome };
  }

  private listParams(page: number, opts: ListOpts): URLSearchParams {
    const p = new URLSearchParams();
    p.append("originalLanguage[]", "ko");
    p.append("availableTranslatedLanguage[]", "en");
    p.set("hasAvailableChapters", "true");
    p.append("includes[]", "cover_art");
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String((page - 1) * PAGE_SIZE));
    for (const r of ["safe", "suggestive", ...(opts.mature ? ["erotica", "pornographic"] : [])]) {
      p.append("contentRating[]", r);
    }
    return p;
  }

  private async list(p: URLSearchParams, page: number): Promise<Page<TitleSummary>> {
    const body = parse(MangaListSchema, await this.deps.fetchJson(`${this.base}/manga?${p}`, this.buckets.general));
    return { items: body.data.map(toSummary), page, hasMore: body.offset + body.limit < body.total };
  }

  home(page: number, opts: ListOpts) {
    const p = this.listParams(page, opts);
    p.set("order[latestUploadedChapter]", "desc");
    return this.list(p, page);
  }

  search(q: string, page: number, opts: ListOpts) {
    const p = this.listParams(page, opts);
    p.set("title", q);
    p.set("order[relevance]", "desc");
    return this.list(p, page);
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
    const ah = await this.atHome(chapterId);
    return {
      titleId: encodeId("md", rawId),
      chapterId,
      pages: ah.files.map((f) => `/api/img/md/${chapterId}/${f}`),
    };
  }
}
