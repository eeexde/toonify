import type { z } from "zod";
import type { TokenBucket } from "../../ratelimit";
import { UpstreamError } from "../errors";
import type { FetchJson } from "../http";
import { encodeId } from "../ids";
import { LIMITERS } from "../limiters";
import type { ChapterPages, ListOpts, Page, Source, Title, TitleSummary } from "../types";
import { toSummaries, toTitle } from "./normalize";
import { ChapterSchema, DetailSchema, FailureSchema, ListSchema } from "./schemas";

export { chapterNumberOf } from "./normalize";

export class ScraperGoSource implements Source {
  private base: string;
  private bucket: TokenBucket;

  constructor(private deps: { fetchJson: FetchJson; bucket?: TokenBucket; baseUrl?: string }) {
    this.base = deps.baseUrl ?? "https://scrapergo.vercel.app";
    this.bucket = deps.bucket ?? LIMITERS.scrapergo;
  }

  private async get<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
    let body: unknown;
    try {
      body = await this.deps.fetchJson(`${this.base}${path}`, this.bucket);
    } catch (err) {
      const b = (err as { body?: unknown }).body;
      const fail = FailureSchema.safeParse(b);
      if (fail.success) throw new UpstreamError(`ScraperGo: ${fail.data.message ?? "failed"}`);
      throw err;
    }
    const fail = FailureSchema.safeParse(body);
    if (fail.success) throw new UpstreamError(`ScraperGo: ${fail.data.message ?? "failed"}`);
    const r = schema.safeParse(body);
    if (!r.success) throw new UpstreamError("ScraperGo response did not match schema");
    return r.data;
  }

  async home(page: number, opts: ListOpts): Promise<Page<TitleSummary>> {
    const body = await this.get(`/api/manwha/home/${page}?mature=${opts.mature ? 1 : 0}`, ListSchema);
    const max = Math.max(0, ...(body.pagination ?? []));
    return { items: toSummaries(body), page, hasMore: max > page };
  }

  async search(q: string, page: number, opts: ListOpts): Promise<Page<TitleSummary>> {
    const body = await this.get(`/api/search/${encodeURIComponent(q)}/${page}?mature=${opts.mature ? 1 : 0}`, ListSchema);
    return { items: toSummaries(body), page, hasMore: false };
  }

  async title(rawId: string): Promise<Title> {
    const body = await this.get(`/api/manwha/${encodeURIComponent(rawId)}`, DetailSchema);
    return toTitle(rawId, body);
  }

  async chapter(rawId: string, chapterId: string): Promise<ChapterPages> {
    const body = await this.get(`/api/manwha/${encodeURIComponent(rawId)}/${encodeURIComponent(chapterId)}`, ChapterSchema);
    return { titleId: encodeId("sg", rawId), chapterId, pages: body.data.images };
  }
}
